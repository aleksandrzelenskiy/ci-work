import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import BaseStation, { normalizeBsNumber } from '@/app/models/BaseStation';
import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';

export const runtime = 'nodejs';

interface KmlPoint { coordinates?: string[] } // "lon,lat,alt"
interface KmlPlacemark { name?: string[]; description?: string[]; Point?: KmlPoint[] }
interface KmlFolderLike { Placemark?: KmlPlacemark[]; Folder?: KmlFolderLike[] }
type KmlDocument = KmlFolderLike;
interface KmlRoot { kml?: { Document?: KmlDocument[] } }

function to6(x: number) { return Number(x.toFixed(6)); }
function coordKey(lat: number, lon: number) { return `${to6(lat)}|${to6(lon)}`; }
function coordString(lat: number, lon: number) { return `${to6(lat)} ${to6(lon)}`; }

function collectPlacemarks(node?: KmlFolderLike): KmlPlacemark[] {
    if (!node) return [];
    const out: KmlPlacemark[] = [];
    if (Array.isArray(node.Placemark)) out.push(...node.Placemark);
    if (Array.isArray(node.Folder)) node.Folder.forEach(f => out.push(...collectPlacemarks(f)));
    return out;
}

type ImportSummary = {
    message: string;
    inserted: number;
    updated: number;
    skipped: number;
    duplicatesInFile: number;
};

export async function POST(req: NextRequest) {
    try {
        await dbConnect();

        const formData = await req.formData();
        const file = formData.get('file');
        if (!file || !(file instanceof Blob)) {
            return NextResponse.json({ message: 'Не найден файл в поле "file"' }, { status: 400 });
        }

        const buf = Buffer.from(await (file as Blob).arrayBuffer());
        const zip = new AdmZip(buf);
        const entries = zip.getEntries();

        const kmlEntry =
            entries.find(e => e.entryName.toLowerCase().endsWith('doc.kml')) ||
            entries.find(e => e.entryName.toLowerCase().endsWith('.kml'));

        if (!kmlEntry) {
            return NextResponse.json({ message: 'В KMZ не найден KML-файл' }, { status: 400 });
        }

        const kmlContent = kmlEntry.getData().toString('utf-8');
        const parsed = (await parseStringPromise(kmlContent, { explicitArray: true })) as KmlRoot;

        const doc = parsed.kml?.Document?.[0];
        if (!doc) {
            return NextResponse.json({ message: 'Некорректная структура KML: отсутствует Document' }, { status: 400 });
        }

        const placemarks = collectPlacemarks(doc);
        if (!placemarks.length) {
            return NextResponse.json({ message: 'В KML нет точек (Placemark)' }, { status: 400 });
        }

        // Подготовка строк (де-дуп внутри файла по coordKey)
        type Row = { name: string; address: string; lat: number; lon: number; key: string; coords: string };
        const seen = new Set<string>();
        const rows: Row[] = [];
        let duplicatesInFile = 0;

        for (const pm of placemarks) {
            const name = (pm.name?.[0] || '').trim();
            const address = (pm.description?.[0] || '').trim();
            const c = pm.Point?.[0]?.coordinates?.[0]?.trim();
            if (!c) continue;

            const [lonStr, latStr] = c.split(',');
            const lon = Number(lonStr);
            const lat = Number(latStr);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

            const key = coordKey(lat, lon);
            if (seen.has(key)) { duplicatesInFile++; continue; }
            seen.add(key);

            rows.push({
                name,
                address,
                lat: to6(lat),
                lon: to6(lon),
                key,
                coords: coordString(lat, lon),
            });
        }

        const summary: ImportSummary = {
            message: 'Импорт завершён',
            inserted: 0,
            updated: 0,
            skipped: 0,
            duplicatesInFile,
        };

        if (rows.length) {
            const ops = rows.map((r) => {
                const normalizedName = normalizeBsNumber(r.name || '');
                const finalName = normalizedName || r.name || '';
                return {
                    updateOne: {
                        filter: { coordKey: r.key },
                        update: {
                            $set: {
                                address: r.address || '',
                                coordinates: r.coords,
                                lat: r.lat,
                                lon: r.lon,
                                source: 'kmz',
                                coordKey: r.key,
                            },
                            $setOnInsert: {
                                name: finalName,
                                num: finalName,
                            },
                        },

                        upsert: true,
                    },
                };
            });

            const res = await BaseStation.bulkWrite(ops, { ordered: false });
            const upserts = res?.upsertedCount ?? 0;
            const matched = res?.matchedCount ?? 0;

            summary.inserted = upserts;
            summary.updated = matched;
            summary.skipped = rows.length - upserts - matched;
        }

        return NextResponse.json(summary);
    } catch (error: unknown) {
        console.error('KMZ import error:', error);
        return NextResponse.json({ message: 'Ошибка импорта KMZ' }, { status: 500 });
    }
}

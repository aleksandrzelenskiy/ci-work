// src/app/api/objects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import mongoose, { Schema, Model } from 'mongoose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Опишем минимальную модель под твою коллекцию
interface IRegionObject {
    _id: mongoose.Types.ObjectId;
    name: string;        // "IR2506, Танар"
    address?: string;
    lat?: number;
    lon?: number;
    coordKey?: string;
    source?: string;
}

let RegionObjectModel: Model<IRegionObject>;

try {
    RegionObjectModel = mongoose.model<IRegionObject>('RegionObject');
} catch {
    RegionObjectModel = mongoose.model<IRegionObject>(
        'RegionObject',
        new Schema<IRegionObject>(
            {
                name: { type: String, required: true },
                address: { type: String },
                lat: { type: Number },
                lon: { type: Number },
                coordKey: { type: String },
                source: { type: String },
            },
            {
                collection: 'objects-t2-ir', // ВАЖНО: твоя коллекция
                timestamps: true,
            }
        )
    );
}

export async function GET(req: NextRequest) {
    try {
        await dbConnect();

        const { searchParams } = new URL(req.url);
        const q = searchParams.get('q')?.trim() ?? '';
        const limit = Number(searchParams.get('limit') ?? 20);

        const filter: Record<string, unknown> = {};
        if (q) {
            // ищем по началу или вхождению имени
            filter.name = { $regex: q, $options: 'i' };
        }

        const docs = await RegionObjectModel.find(filter)
            .sort({ name: 1 })
            .limit(limit)
            .lean();

        return NextResponse.json({
            objects: docs.map((d) => ({
                id: d._id.toString(),
                name: d.name,
                address: d.address ?? '',
                lat: typeof d.lat === 'number' ? d.lat : null,
                lon: typeof d.lon === 'number' ? d.lon : null,
            })),
        });
    } catch (e: unknown) {
        console.error(e);
        return NextResponse.json({ error: 'Failed to load objects' }, { status: 500 });
    }
}

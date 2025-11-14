// src/app/api/bsmap/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import { getBsCoordinateModel } from '@/app/models/BsCoordinateModel';
import { Types } from 'mongoose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPERATOR_COLLECTIONS: Record<string, { collection: string; label: string }> = {
    t2: { collection: '38-t2-bs-coords', label: 'T2' },
    beeline: { collection: '38-beeline-bs-coords', label: 'Билайн' },
    megafon: { collection: '38-megafon-bs-coords', label: 'Мегафон' },
    mts: { collection: '38-mts-bs-coords', label: 'МТС' },
};

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const { searchParams } = new URL(request.url);
        const operatorParam = searchParams.get('operator')?.toLowerCase().trim() ?? 't2';
        const operator = OPERATOR_COLLECTIONS[operatorParam] ? operatorParam : 't2';
        const { collection } = OPERATOR_COLLECTIONS[operator];

        await dbConnect();
        const Model = getBsCoordinateModel(collection);
        const stations = await Model.find({}, { op: 1, num: 1, lat: 1, lon: 1, mcc: 1, mnc: 1 })
            .lean()
            .exec();

        return NextResponse.json({
            operator,
            stations: stations.map((station) => ({
                _id: station._id.toString(),
                op: station.op ?? null,
                num: station.num ?? null,
                lat: station.lat,
                lon: station.lon,
                mcc: station.mcc ?? null,
                mnc: station.mnc ?? null,
            })),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load base stations';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

type StationPayload = {
    op: string | null;
    num: number | null;
    lat: number;
    lon: number;
    mcc: string | null;
    mnc: string | null;
};
type StationDocument = StationPayload & { _id: Types.ObjectId | string };

function normalizeOperator(value: string | null | undefined): keyof typeof OPERATOR_COLLECTIONS | null {
    const key = value?.toLowerCase().trim();
    if (key && key in OPERATOR_COLLECTIONS) {
        return key as keyof typeof OPERATOR_COLLECTIONS;
    }
    return null;
}

function serializeStation(doc: StationDocument): StationPayload & { _id: string } {
    return {
        _id: typeof doc._id === 'string' ? doc._id : doc._id.toString(),
        op: doc.op ?? null,
        num: doc.num ?? null,
        lat: doc.lat,
        lon: doc.lon,
        mcc: doc.mcc ?? null,
        mnc: doc.mnc ?? null,
    };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const body = (await request.json().catch(() => null)) as
            | { operator?: string; num?: number | null; lat?: number; lon?: number }
            | null;

        if (!body || typeof body.lat !== 'number' || typeof body.lon !== 'number') {
            return NextResponse.json({ error: 'Некорректные данные' }, { status: 400 });
        }

        const operatorKey = normalizeOperator(body.operator) ?? 't2';
        const collectionEntry = OPERATOR_COLLECTIONS[operatorKey];
        const numValue = body.num === null || typeof body.num === 'number' ? body.num ?? null : null;

        await dbConnect();
        const Model = getBsCoordinateModel(collectionEntry.collection);
        const createdDoc = await Model.create({
            op: operatorKey,
            num: numValue,
            lat: body.lat,
            lon: body.lon,
        });
        const created = createdDoc.toObject() as StationDocument;

        return NextResponse.json({ station: serializeStation(created), operator: operatorKey }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось создать базовую станцию';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
    try {
        const body = (await request.json().catch(() => null)) as
            | { id?: string; operator?: string; num?: number | null; lat?: number; lon?: number }
            | null;

        if (!body || !body.id || typeof body.id !== 'string') {
            return NextResponse.json({ error: 'Не указан идентификатор базовой станции' }, { status: 400 });
        }

        const operatorKey = normalizeOperator(body.operator) ?? 't2';
        const collectionEntry = OPERATOR_COLLECTIONS[operatorKey];

        if (typeof body.lat !== 'number' || Number.isNaN(body.lat) || typeof body.lon !== 'number' || Number.isNaN(body.lon)) {
            return NextResponse.json({ error: 'Некорректные координаты' }, { status: 400 });
        }

        const updatePayload: Partial<StationPayload> = {
            lat: body.lat,
            lon: body.lon,
        };

        if (body.num === null || typeof body.num === 'number') {
            updatePayload.num = body.num;
        }

        await dbConnect();
        const Model = getBsCoordinateModel(collectionEntry.collection);
        const updated = (await Model.findByIdAndUpdate(body.id, { $set: updatePayload }, { new: true, lean: true })) as
            | StationDocument
            | null;

        if (!updated) {
            return NextResponse.json({ error: 'Базовая станция не найдена' }, { status: 404 });
        }

        return NextResponse.json({ station: serializeStation(updated), operator: operatorKey });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось обновить базовую станцию';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
    try {
        const body = (await request.json().catch(() => null)) as { id?: string; operator?: string } | null;

        if (!body || !body.id || typeof body.id !== 'string') {
            return NextResponse.json({ error: 'Не указан идентификатор базовой станции' }, { status: 400 });
        }

        const operatorKey = normalizeOperator(body.operator) ?? 't2';
        const collectionEntry = OPERATOR_COLLECTIONS[operatorKey];

        await dbConnect();
        const Model = getBsCoordinateModel(collectionEntry.collection);
        const deleted = (await Model.findByIdAndDelete(body.id).lean()) as StationDocument | null;

        if (!deleted) {
            return NextResponse.json({ error: 'Базовая станция не найдена' }, { status: 404 });
        }

        return NextResponse.json({ success: true, id: body.id });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось удалить базовую станцию';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

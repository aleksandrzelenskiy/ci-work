// src/app/api/bsmap/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import BsCoordinateModel from '@/app/models/BsCoordinateModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
    try {
        await dbConnect();
        const stations = await BsCoordinateModel.find({}, { op: 1, num: 1, lat: 1, lon: 1, mcc: 1, mnc: 1 })
            .lean()
            .exec();

        return NextResponse.json({
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

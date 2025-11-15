// app/models/BaseStation.ts

import mongoose, { Schema, model, models, Document } from 'mongoose';

export const IRKUTSK_REGION_CODE = '38';
export const T2_OPERATOR_CODE = '250020';
const T2_OPERATOR_SLUGS = new Set(['t2', 't-2', '250020', '250-20']);

export interface IBaseStation extends Document {
    name?: string;
    num?: string;
    coordinates?: string;
    address?: string;
    lat?: number;
    lon?: number;
    coordKey?: string;
    source?: string;
    region?: string;
    regionCode?: string;
    op?: string;
    operatorCode?: string;
    mcc?: string;
    mnc?: string;
}

function to6(x: number) {
    return Number(x.toFixed(6));
}
function makeCoordKey(lat: number, lon: number) {
    return `${to6(lat)}|${to6(lon)}`;
}

export function normalizeBsNumber(input: string): string {
    if (!input) return '';
    const base = input.split(',')[0] ?? input;
    return base.trim().toUpperCase();
}

function normalizeOperatorCode(input?: string | null): string | undefined {
    if (!input) return undefined;
    const trimmed = input.trim();
    if (!trimmed) return undefined;
    const lower = trimmed.toLowerCase();
    if (T2_OPERATOR_SLUGS.has(lower)) return T2_OPERATOR_CODE;
    return trimmed;
}

export function isIrkutskT2(region?: string | null, operator?: string | null): boolean {
    const reg = (region ?? '').trim();
    if (reg !== IRKUTSK_REGION_CODE) return false;
    if (!operator) return false;
    const op = operator.trim().toLowerCase();
    if (!op) return false;
    if (T2_OPERATOR_SLUGS.has(op)) return true;
    return operator.trim() === T2_OPERATOR_CODE;
}

const BaseStationSchema = new Schema<IBaseStation>(
    {
        name: { type: String, index: true },
        num: { type: String, index: true },
        coordinates: { type: String, default: '' }, // "lat lon"
        address: { type: String, default: '' },
        lat: { type: Number },
        lon: { type: Number },
        coordKey: { type: String, index: true, unique: true, sparse: true },
        source: { type: String, default: 'kmz' },
        region: { type: String, index: true },
        regionCode: { type: String, index: true },
        op: { type: String, index: true },
        operatorCode: { type: String, index: true },
        mcc: { type: String },
        mnc: { type: String },
    },
    { timestamps: true }
);

// синхронизация строки и ключа, если заданы lat/lon
BaseStationSchema.pre('save', function (next) {
    if (typeof this.lat === 'number' && typeof this.lon === 'number') {
        const lat6 = to6(this.lat);
        const lon6 = to6(this.lon);
        this.lat = lat6;
        this.lon = lon6;
        this.coordinates = `${lat6} ${lon6}`;
        this.coordKey = makeCoordKey(lat6, lon6);
    }

    if (this.name && !this.num) {
        this.num = normalizeBsNumber(this.name);
    }
    if (this.num) {
        const normalized = normalizeBsNumber(this.num);
        this.num = normalized;
        if (!this.name) this.name = normalized;
    }

    const region = this.regionCode || this.region;
    if (region) {
        this.region = region;
        this.regionCode = region;
    }

    const opCode = normalizeOperatorCode(this.operatorCode || this.op);
    if (opCode) {
        this.operatorCode = opCode;
        if (!this.op && opCode === T2_OPERATOR_CODE) this.op = 't2';
        if (opCode === T2_OPERATOR_CODE) {
            if (!this.mcc) this.mcc = '250';
            if (!this.mnc) this.mnc = '020';
        }
    }

    next();
});

const modelCache = new Map<string, mongoose.Model<IBaseStation>>();

function getOrCreateModel(collectionName: string): mongoose.Model<IBaseStation> {
    if (modelCache.has(collectionName)) return modelCache.get(collectionName)!;

    const modelName = `BaseStation_${collectionName}`;
    const existingModel = models[modelName] as mongoose.Model<IBaseStation> | undefined;
    if (existingModel) {
        modelCache.set(collectionName, existingModel);
        return existingModel;
    }

    const createdModel = model<IBaseStation>(modelName, BaseStationSchema, collectionName);
    modelCache.set(collectionName, createdModel);
    return createdModel;
}

export function getBaseStationModel(collectionName: string): mongoose.Model<IBaseStation> {
    return getOrCreateModel(collectionName);
}

const BaseStation = getOrCreateModel('38-t2-bs-coords');
type StationSyncPayload = {
    bsNumber: string;
    bsAddress?: string;
    lat?: number | null;
    lon?: number | null;
    regionCode?: string | null;
    operatorCode?: string | null;
};

function sanitizeCoordinate(value?: number | null): number | undefined {
    if (typeof value !== 'number') return undefined;
    if (!Number.isFinite(value)) return undefined;
    return to6(value);
}

export async function ensureIrkutskT2Station(payload: StationSyncPayload): Promise<void> {
    if (!isIrkutskT2(payload.regionCode, payload.operatorCode)) return;
    const normalized = normalizeBsNumber(payload.bsNumber);
    if (!normalized) return;

    const lat = sanitizeCoordinate(payload.lat);
    const lon = sanitizeCoordinate(payload.lon);

    const match = await BaseStation.findOne({
        $or: [{ name: normalized }, { num: normalized }],
    });

    if (!match) {
        await BaseStation.create({
            name: normalized,
            num: normalized,
            address: payload.bsAddress?.trim() || undefined,
            lat,
            lon,
            region: IRKUTSK_REGION_CODE,
            regionCode: IRKUTSK_REGION_CODE,
            op: 't2',
            operatorCode: T2_OPERATOR_CODE,
            mcc: '250',
            mnc: '020',
            source: 'tasks',
        });
        return;
    }

    let dirty = false;

    if (!match.address && payload.bsAddress) {
        match.address = payload.bsAddress.trim();
        dirty = true;
    }
    if (typeof lat === 'number' && typeof match.lat !== 'number') {
        match.lat = lat;
        dirty = true;
    }
    if (typeof lon === 'number' && typeof match.lon !== 'number') {
        match.lon = lon;
        dirty = true;
    }
    if (!match.regionCode) {
        match.regionCode = IRKUTSK_REGION_CODE;
        dirty = true;
    }
    if (!match.region) {
        match.region = IRKUTSK_REGION_CODE;
        dirty = true;
    }
    if (!match.operatorCode) {
        match.operatorCode = T2_OPERATOR_CODE;
        dirty = true;
    }
    if (!match.op) {
        match.op = 't2';
        dirty = true;
    }
    if (!match.mcc) {
        match.mcc = '250';
        dirty = true;
    }
    if (!match.mnc) {
        match.mnc = '020';
        dirty = true;
    }
    if (!match.source) {
        match.source = 'tasks';
        dirty = true;
    }

    if (dirty) {
        await match.save();
    }
}

export default BaseStation;

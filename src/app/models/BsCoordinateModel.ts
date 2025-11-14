// src/app/models/BsCoordinateModel.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface BsCoordinate extends Document {
    op?: string;
    num?: number;
    lat: number;
    lon: number;
    mcc?: string;
    mnc?: string;
}

const schema = new Schema<BsCoordinate>(
    {
        op: { type: String },
        num: { type: Number },
        lat: { type: Number, required: true },
        lon: { type: Number, required: true },
        mcc: { type: String },
        mnc: { type: String },
    },
    { versionKey: false }
);

const MODEL_CACHE: Record<string, Model<BsCoordinate>> = {};

export function getBsCoordinateModel(collectionName: string): Model<BsCoordinate> {
    if (!MODEL_CACHE[collectionName]) {
        const modelName = `BsCoordinate_${collectionName}`;
        MODEL_CACHE[collectionName] =
            (mongoose.models[modelName] as Model<BsCoordinate>) ||
            mongoose.model<BsCoordinate>(modelName, schema, collectionName);
    }
    return MODEL_CACHE[collectionName];
}

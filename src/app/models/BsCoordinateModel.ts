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

const BsCoordinateSchema = new Schema<BsCoordinate>(
    {
        op: { type: String },
        num: { type: Number },
        lat: { type: Number, required: true },
        lon: { type: Number, required: true },
        mcc: { type: String },
        mnc: { type: String },
    },
    {
        collection: '38-t2-bs-coords',
        versionKey: false,
    }
);

const BsCoordinateModel: Model<BsCoordinate> =
    (mongoose.models.BsCoordinate as Model<BsCoordinate>) ||
    mongoose.model<BsCoordinate>('BsCoordinate', BsCoordinateSchema, '38-t2-bs-coords');

export default BsCoordinateModel;

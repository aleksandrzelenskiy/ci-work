import mongoose, { Schema, model, models, Document } from 'mongoose';

export interface IBaseStation extends Document {
    name: string;
    coordinates: string;   // "lat lon" (для UI/обратной совместимости)
    address?: string;
    lat?: number;
    lon?: number;
    coordKey?: string;     // "lat6|lon6" — уникальный ключ для upsert
    source?: string;       // 'kmz' | 'manual' и т.п.
}

function to6(x: number) {
    return Number(x.toFixed(6));
}
function makeCoordKey(lat: number, lon: number) {
    return `${to6(lat)}|${to6(lon)}`;
}

const BaseStationSchema = new Schema<IBaseStation>(
    {
        name: { type: String, required: true, index: true },
        coordinates: { type: String, required: true }, // "lat lon"
        address: { type: String, default: '' },
        lat: { type: Number },
        lon: { type: Number },
        coordKey: { type: String, index: true, unique: true, sparse: true },
        source: { type: String, default: 'kmz' },
    },
    { collection: 'objects-t2-ir', timestamps: true }
);

// синхронизация строки и ключа, если заданы lat/lon
BaseStationSchema.pre('save', function (next) {
    if (typeof this.lat === 'number' && typeof this.lon === 'number') {
        const lat6 = to6(this.lat);
        const lon6 = to6(this.lon);
        this.coordinates = `${lat6} ${lon6}`;
        this.coordKey = makeCoordKey(lat6, lon6);
    }
    next();
});

const BaseStation =
    (models.BaseStation as mongoose.Model<IBaseStation>) ||
    model<IBaseStation>('BaseStation', BaseStationSchema);

export default BaseStation;

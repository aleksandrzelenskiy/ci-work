// app/models/OrganizationModel.ts

import mongoose, { Schema, Document, models, model } from 'mongoose';

export interface Organization extends Document {
    name: string;
    slug: string;
    ownerEmail: string;
    createdByEmail: string;
    createdAt: Date;
}

const OrganizationSchema = new Schema<Organization>(
    {
        name: { type: String, required: true },
        slug: { type: String, required: true, unique: true, index: true },
        ownerEmail: { type: String, required: true, index: true },
        createdByEmail: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

export default (models.Organization as mongoose.Model<Organization>) ||
model<Organization>('Organization', OrganizationSchema);

// app/models/OrganizationModel.ts

import mongoose, { Schema, Document, models, model } from 'mongoose';

export interface Organization extends Document {
    name: string;
    orgSlug: string;
    slug?: string;
    ownerEmail: string;
    createdByEmail: string;
    createdAt: Date;
}

const OrganizationSchema = new Schema<Organization>(
    {
        name: { type: String, required: true },
        orgSlug: { type: String, required: true, unique: true, index: true },
        slug: { type: String, unique: true, sparse: true },
        ownerEmail: { type: String, required: true, index: true },
        createdByEmail: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

export default (models.Organization as mongoose.Model<Organization>) ||
model<Organization>('Organization', OrganizationSchema);

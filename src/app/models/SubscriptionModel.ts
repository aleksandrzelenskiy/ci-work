// src/app/models/SubscriptionModel.ts
import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface Subscription extends Document {
    orgId: mongoose.Types.ObjectId;
    plan: 'free' | 'basic' | 'pro' | 'enterprise';
    status: 'active' | 'trial' | 'suspended' | 'past_due' | 'inactive';
    seats?: number;            // лимит мест
    projectsLimit?: number;    // лимит проектов
    periodStart?: Date;
    periodEnd?: Date;
    note?: string;             // номер счёта/комментарии
    updatedByEmail?: string;   // кто включил/изменил
    updatedAt: Date;
}

const SubscriptionSchema = new Schema<Subscription>(
    {
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, unique: true },
        plan: { type: String, enum: ['free', 'basic', 'pro', 'enterprise'], default: 'free' },
        status: { type: String, enum: ['active', 'trial', 'suspended', 'past_due', 'inactive'], default: 'inactive' },
        seats: { type: Number, default: 10 },
        projectsLimit: { type: Number, default: 10 },
        periodStart: { type: Date },
        periodEnd: { type: Date },
        note: { type: String },
        updatedByEmail: { type: String },
        updatedAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

export default (models.Subscription as mongoose.Model<Subscription>) ||
model<Subscription>('Subscription', SubscriptionSchema);

// src/app/models/UserModel.ts

import mongoose, { Schema, Document, model, models, Types } from 'mongoose';
import type { PlatformRole } from '@/app/types/roles';
export type ProfileType = 'client' | 'contractor' | 'both';
export type SubscriptionTier = 'free' | 'team' | 'enterprise';
export type BillingStatus = 'trial' | 'active' | 'past_due' | 'canceled';

export interface IUser extends Document {
    name: string;
    email: string;
    profilePic: string;
    clerkUserId: string;
    platformRole: PlatformRole;
    profileType: ProfileType;
    subscriptionTier: SubscriptionTier;
    billingStatus: BillingStatus;
    activeOrgId?: Types.ObjectId | null;
    regionCode?: string;
}

const UserSchema = new Schema<IUser>(
    {
        name: { type: String, required: true, trim: true },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        profilePic: { type: String, required: true, trim: true },
        clerkUserId: { type: String, required: true, unique: true, index: true },
        platformRole: {
            type: String,
            enum: ['super_admin', 'staff', 'user'],
            default: 'user',
        },
        profileType: {
            type: String,
            enum: ['client', 'contractor', 'both'],
            default: 'client',
        },
        subscriptionTier: {
            type: String,
            enum: ['free', 'team', 'enterprise'],
            default: 'free',
        },
        billingStatus: {
            type: String,
            enum: ['trial', 'active', 'past_due', 'canceled'],
            default: 'trial',
        },
        activeOrgId: {
            type: Schema.Types.ObjectId,
            ref: 'Organization',
            default: null,
        },
        regionCode: {
            type: String,
            default: '',
        },
    },
    { timestamps: true, collection: 'users' }
);

export default (models.User as mongoose.Model<IUser>) || model<IUser>('User', UserSchema);

// src/app/models/UserModel.ts

import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface IUser extends Document {
    name: string;
    email: string;
    profilePic: string;
    clerkUserId: string;
    role: 'admin' | 'manager' | 'author' | 'initiator' | 'executor';
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
        role: {
            type: String,
            enum: ['admin', 'manager', 'author', 'initiator', 'executor'],
            default: 'executor',
        },
    },
    { timestamps: true, collection: 'users' }
);

export default (models.User as mongoose.Model<IUser>) || model<IUser>('User', UserSchema);

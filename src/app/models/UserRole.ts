// /app/models/UserRole.ts

import mongoose, { Schema, Document } from 'mongoose';
import { IUserRole } from '../types/userTypes';

/**
 * Интерфейс для модели UserRole, расширяющий IUserRole и Document.
 */
export interface IUserRoleModel extends IUserRole, Document {}

/**
 * Схема для UserRole.
 */
const UserRoleSchema: Schema<IUserRoleModel> = new Schema(
  {
    clerkUserId: { type: String, required: true, unique: true },
    role: {
      type: String,
      required: true,
      enum: ['author', 'reviewer', 'admin', 'member'],
      default: 'member',
    },
  },
  { timestamps: true }
);

/**
 * Модель UserRole.
 * Избегаем повторной компиляции модели в режиме разработки.
 */
export default mongoose.models.UserRole ||
  mongoose.model<IUserRoleModel>('UserRole', UserRoleSchema);

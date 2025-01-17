// /lib/getUserRole.ts

import UserRole from '../app/models/UserRole';
import { IUserRole } from '../app/types/userTypes';

/**
 * Получает роль пользователя по его Clerk ID.
 * @param clerkUserId Идентификатор пользователя из Clerk.
 * @returns Роль пользователя или 'unknown', если роль не назначена.
 */
export async function getUserRole(clerkUserId: string): Promise<string> {
  try {
    const userRole: IUserRole | null = await UserRole.findOne({ clerkUserId });
    return userRole?.role || 'unknown';
  } catch (error) {
    console.error('Ошибка при получении роли пользователя:', error);
    return 'unknown';
  }
}

// /lib/getCurrentUser.ts

import { currentUser } from '@clerk/nextjs/server';
import { User } from '@clerk/clerk-sdk-node';
import { getUserRole } from './getUserRole';

/**
 * Расширенный тип пользователя с дополнительным полем 'role'.
 */
export interface ExtendedUser extends User {
  role: 'author' | 'reviewer' | 'admin' | 'member' | 'unknown';
}

/**
 * Получает текущего пользователя с его ролью из собственной базы данных.
 * @returns ExtendedUser или null, если пользователь не найден.
 */
export async function getCurrentUserWithRole(): Promise<ExtendedUser | null> {
  const user = await currentUser();

  if (!user) return null;

  const role = await getUserRole(user.id);

  return { ...user, role: role || 'unknown' } as ExtendedUser;
}

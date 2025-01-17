// /app/types/userTypes.ts

export interface IUserRole {
  clerkUserId: string;
  role: 'author' | 'reviewer' | 'admin' | 'member';
  createdAt?: Date;
  updatedAt?: Date;
}

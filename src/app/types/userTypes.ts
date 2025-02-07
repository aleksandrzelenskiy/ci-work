// /app/types/userTypes.ts

export interface IUserRole {
  clerkUserId: string;
  role: 'admin' | 'author' | 'initiator' | 'executor' | 'member';
  createdAt?: Date;
  updatedAt?: Date;
}

// app/api/users/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import UserModel from '@/app/models/UserModel';

export async function GET() {
  try {
    await dbConnect();
    const users = await UserModel.find({}, 'name email role');
    return NextResponse.json(users);
  } catch (error) {
    console.error('Ошибка при получении пользователей:', error);
    return NextResponse.json(
      { error: 'Ошибка при загрузке пользователей' },
      { status: 500 }
    );
  }
}

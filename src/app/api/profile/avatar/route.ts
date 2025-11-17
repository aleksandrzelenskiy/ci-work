import { NextResponse } from 'next/server';
import { clerkClient, currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import UserModel from '@/app/models/UserModel';

export async function POST(request: Request) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const formData = await request.formData();
    const avatarFile = formData.get('avatar');
    if (!(avatarFile instanceof Blob)) {
      return NextResponse.json(
        { error: 'Файл аватара не найден' },
        { status: 400 }
      );
    }

    const updated = await clerkClient.users.updateUserProfileImage(
      clerkUser.id,
      { file: avatarFile }
    );

    const imageUrl = updated.imageUrl;

    await dbConnect();
    await UserModel.findOneAndUpdate(
      { clerkUserId: clerkUser.id },
      { profilePic: imageUrl },
      { new: true }
    );

    return NextResponse.json({ ok: true, imageUrl });
  } catch (error) {
    console.error('POST /api/profile/avatar error:', error);
    return NextResponse.json(
      { error: 'Не удалось обновить аватар' },
      { status: 500 }
    );
  }
}

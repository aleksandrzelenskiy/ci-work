import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import UserModel from '@/app/models/UserModel';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';

const sanitizeString = (value?: string | null) => value?.trim() ?? '';

const isValidRegionCode = (value?: string) =>
  !!value && RUSSIAN_REGIONS.some((region) => region.code === value);

export async function GET() {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    await dbConnect();
    const user = await UserModel.findOne({ clerkUserId: clerkUser.id }).lean();
    if (!user) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      regionCode: user.regionCode ?? '',
      profilePic: user.profilePic || clerkUser.imageUrl || '',
    });
  } catch (error) {
    console.error('GET /api/profile error:', error);
    return NextResponse.json(
      { error: 'Не удалось загрузить профиль' },
      { status: 500 }
    );
  }
}

type ProfilePatchPayload = {
  name?: string;
  phone?: string;
  regionCode?: string;
};

export async function PATCH(request: Request) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const body = (await request.json()) as ProfilePatchPayload;
    const nextName =
      typeof body.name === 'string' ? sanitizeString(body.name) : undefined;
    const nextPhone =
      typeof body.phone === 'string' ? sanitizeString(body.phone) : undefined;
    const nextRegion =
      typeof body.regionCode === 'string' ? sanitizeString(body.regionCode) : undefined;

    if (typeof body.name !== 'undefined' && !nextName) {
      return NextResponse.json(
        { error: 'Имя не может быть пустым' },
        { status: 400 }
      );
    }

    if (typeof nextRegion !== 'undefined' && !isValidRegionCode(nextRegion)) {
      return NextResponse.json(
        { error: 'Некорректный регион' },
        { status: 400 }
      );
    }

    await dbConnect();

    const updatePayload: Record<string, string> = {};
    if (typeof nextName !== 'undefined') {
      updatePayload.name = nextName;
    }
    if (typeof nextPhone !== 'undefined') {
      updatePayload.phone = nextPhone;
    }
    if (typeof nextRegion !== 'undefined') {
      updatePayload.regionCode = nextRegion;
    }
    if (!Object.keys(updatePayload).length) {
      return NextResponse.json(
        { error: 'Нет данных для обновления' },
        { status: 400 }
      );
    }

    const updatedUser = await UserModel.findOneAndUpdate(
      { clerkUserId: clerkUser.id },
      { $set: updatePayload },
      { new: true }
    ).lean();

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Пользователь не найден' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      profile: {
        name: updatedUser.name,
        phone: updatedUser.phone ?? '',
        email: updatedUser.email,
        regionCode: updatedUser.regionCode ?? '',
        profilePic: updatedUser.profilePic || clerkUser.imageUrl || '',
      },
    });
  } catch (error) {
    console.error('PATCH /api/profile error:', error);
    return NextResponse.json(
      { error: 'Не удалось обновить профиль' },
      { status: 500 }
    );
  }
}

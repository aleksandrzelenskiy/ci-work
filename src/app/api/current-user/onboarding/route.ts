import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import UserModel, { type ProfileType } from '@/app/models/UserModel';

const VALID_PROFILE_TYPES: ProfileType[] = ['client', 'contractor'];

export async function POST(request: Request) {
  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { profileType?: string } = {};
  try {
    body = (await request.json()) as { profileType?: string };
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
  }

  const profileType = body.profileType as ProfileType | undefined;
  if (!profileType || !VALID_PROFILE_TYPES.includes(profileType)) {
    return NextResponse.json(
      { error: 'Выберите роль: заказчик, исполнитель или оба' },
      { status: 400 }
    );
  }

  await dbConnect();

  const updatePayload: Partial<{
    profileType: ProfileType;
    profileSetupCompleted: boolean;
    activeOrgId: null;
    platformRole: string;
  }> = {
    profileType,
    profileSetupCompleted: true,
    platformRole: 'user',
  };

  if (profileType === 'contractor') {
    updatePayload.activeOrgId = null;
  }

  const updatedUser = await UserModel.findOneAndUpdate(
    { clerkUserId: clerkUser.id },
    updatePayload,
    { new: true }
  ).lean();

  if (!updatedUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    profileType: updatedUser.profileType,
    profileSetupCompleted: updatedUser.profileSetupCompleted,
  });
}

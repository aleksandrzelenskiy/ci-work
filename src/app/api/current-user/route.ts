// app/api/current-user/route.ts
import { NextResponse } from 'next/server';
import { GetUserContext } from '@/server-actions/user-context';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import UserModel from '@/app/models/UserModel';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';

export async function GET() {
  const response = await GetUserContext();

  if (!response.success || !response.data) {
    const status =
      response.message === 'No user session found'
        ? 401
        : response.message?.toLowerCase().includes('unknown')
        ? 500
        : 404;

    return NextResponse.json(
      { error: response.message || 'User context not found' },
      { status }
    );
  }

  const {
    user,
    memberships,
    activeOrgId,
    activeMembership,
    effectiveOrgRole,
    isSuperAdmin,
  } = response.data;
  const membershipRole = activeMembership?.role || null;

  return NextResponse.json({
    membershipRole,
    platformRole: user.platformRole,
    effectiveOrgRole,
    isSuperAdmin,
    regionCode: user.regionCode || '',
    user,
    memberships,
    activeOrgId,
    activeMembership,
  });
}

export async function PATCH(request: Request) {
  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { regionCode } = (await request.json()) as { regionCode?: string };
  if (
    !regionCode ||
    !RUSSIAN_REGIONS.some((region) => region.code === regionCode)
  ) {
    return NextResponse.json({ error: 'Некорректный регион' }, { status: 400 });
  }

  await dbConnect();

  const updated = await UserModel.findOneAndUpdate(
    { clerkUserId: clerkUser.id },
    { regionCode },
    { new: true }
  ).lean();

  if (!updated) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, regionCode: updated.regionCode || '' });
}

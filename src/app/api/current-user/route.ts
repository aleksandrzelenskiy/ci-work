// app/api/current-user/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import UserModel from '@/app/models/UserModel';

console.log(`Into .env: ${process.env.MONGODB_URI}`);

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await UserModel.findOne({ clerkUserId: userId });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ role: user.role });
  } catch (error) {
    console.error('Error fetching user role:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

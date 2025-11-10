// app/api/current-user/route.ts
import { NextResponse } from 'next/server';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';

export async function GET() {
  const response = await GetCurrentUserFromMongoDB();

  if (!response.success || !response.data) {
    const status =
      response.message === 'No user session found'
        ? 401
        : response.message?.toLowerCase().includes('unknown')
        ? 500
        : 404;

    return NextResponse.json(
      { error: response.message || 'User not found' },
      { status }
    );
  }

  return NextResponse.json({ role: response.data.role });
}

// src/app/api/notifications/socket-auth/route.ts

import { NextResponse } from 'next/server';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';
import { signSocketToken } from '@/server/socket/token';

export const runtime = 'nodejs';

export async function GET() {
    const currentUserResponse = await GetCurrentUserFromMongoDB();
    if (!currentUserResponse.success) {
        return NextResponse.json(
            { ok: false, error: currentUserResponse.message },
            { status: 401 }
        );
    }
    const mongoUserId = currentUserResponse.data._id?.toString();
    if (!mongoUserId) {
        return NextResponse.json({ ok: false, error: 'User identifier missing' }, { status: 404 });
    }
    const token = signSocketToken(mongoUserId);
    return NextResponse.json({ ok: true, token });
}

// app/api/org/[org]/members/invite/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import Membership, { OrgRole } from '@/app/models/MembershipModel';
import { requireOrgRole } from '@/app/utils/permissions';
import crypto from 'crypto';
import UserModel from '@/app/models/UserModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:3000';

type InviteBody = { userEmail: string; role?: OrgRole };
type InviteResponse =
    | { ok: true; inviteUrl: string; expiresAt: string; role: OrgRole }
    | { error: string };

function errorMessage(err: unknown) { return err instanceof Error ? err.message : 'Server error'; }

export async function POST(req: NextRequest, ctx: { params: Promise<{ org: string }> }): Promise<NextResponse<InviteResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;

        const me = await currentUser();
        const inviterEmail = me?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
        if (!inviterEmail) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        // приглашать могут owner/org_admin/manager
        const { org } = await requireOrgRole(orgSlug, inviterEmail, ['owner', 'org_admin', 'manager']);

        const body = (await req.json()) as InviteBody;
        const userEmail = body.userEmail?.toLowerCase();
        if (!userEmail) return NextResponse.json({ error: 'userEmail обязателен' }, { status: 400 });

        // ищем пользователя в users
        const userDoc = await UserModel.findOne({ email: userEmail }, { name: 1 }).lean();
        if (!userDoc) {
            return NextResponse.json({ error: 'Пользователь с таким e-mail не зарегистрирован' }, { status: 400 });
        }

        const role: OrgRole = (body.role ?? 'executor') as OrgRole;

        // токен на 7 дней
        const token = crypto.randomBytes(20).toString('hex');
        const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

        await Membership.findOneAndUpdate(
            { orgId: org._id, userEmail },
            {
                $set: {
                    userName: userDoc.name ?? userEmail,
                    role,
                    status: 'invited',
                    invitedByEmail: inviterEmail,
                    inviteToken: token,
                    inviteExpiresAt: expires,
                },
                $setOnInsert: { createdAt: new Date() },
            },
            { upsert: true, new: true }
        );

        const inviteUrl = `${FRONTEND_URL}/org/${encodeURIComponent(orgSlug)}/join?token=${encodeURIComponent(token)}`;
        return NextResponse.json({ ok: true, inviteUrl, expiresAt: expires.toISOString(), role });

    } catch (e) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

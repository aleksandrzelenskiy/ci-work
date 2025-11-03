// src/app/api/org/[org]/members/decline/route.ts
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import Organization from '@/app/models/OrganizationModel';
import Membership from '@/app/models/MembershipModel';
import { Types } from 'mongoose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(err: unknown) { return err instanceof Error ? err.message : 'Server error'; }
type OrgLean = { _id: Types.ObjectId; orgSlug: string };

export async function POST(req: NextRequest, ctx: { params: Promise<{ org: string }> }) {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const { token } = (await req.json()) as { token?: string };

        if (!token) return NextResponse.json({ error: 'token обязателен' }, { status: 400 });

        const org = await Organization.findOne({ orgSlug }, { _id:1, orgSlug:1 }).lean<OrgLean>();
        if (!org) return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });

        const m = await Membership.findOne({
            orgId: org._id,
            status: 'invited',
            inviteToken: token,
            inviteExpiresAt: { $gt: new Date() },
        });
        if (!m) return NextResponse.json({ error: 'Приглашение не найдено или истекло' }, { status: 400 });

        // удаляем приглашение (пока пользователь не активирован)
        await Membership.deleteOne({ _id: m._id });
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

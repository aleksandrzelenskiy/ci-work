// src/app/api/org/[org]/members/accept/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import Organization from '@/app/models/OrganizationModel';
import MembershipModel, { type Membership as MembershipDoc } from '@/app/models/MembershipModel';
import { ensureSeatAvailable } from '@/utils/seats';
import { Types, type FilterQuery } from 'mongoose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(err: unknown) {
    return err instanceof Error ? err.message : 'Server error';
}

type OrgLean = { _id: Types.ObjectId; orgSlug: string };

export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
) {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;

        const { token, email } = (await req.json()) as { token?: string; email?: string };
        if (!token) {
            return NextResponse.json({ error: 'token обязателен' }, { status: 400 });
        }

        const org = await Organization.findOne(
            { orgSlug },
            { _id: 1, orgSlug: 1 }
        ).lean<OrgLean>();
        if (!org) {
            return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });
        }

        // Базовый фильтр приглашения
        const baseFilter: FilterQuery<MembershipDoc> = {
            orgId: org._id,
            status: 'invited',
            inviteToken: token,
            inviteExpiresAt: { $gt: new Date() },
        };
        if (email) baseFilter.userEmail = email.toLowerCase();

        // Сначала пробуем с учётом email (если он есть)
        let m = await MembershipModel.findOne(baseFilter);

        // Если с email не нашли — пробуем без него (вдруг регистр/опечатка)
        if (!m && email) {
            const fallbackFilter: FilterQuery<MembershipDoc> = {
                orgId: org._id,
                status: 'invited',
                inviteToken: token,
                inviteExpiresAt: { $gt: new Date() },
            };
            m = await MembershipModel.findOne(fallbackFilter);
        }

        if (!m) {
            return NextResponse.json({ error: 'Приглашение не найдено или истекло' }, { status: 400 });
        }

        // Проверка лимита мест (seats)
        const seat = await ensureSeatAvailable(org._id);
        if (!seat.ok) {
            return NextResponse.json(
                { error: `Достигнут лимит мест: ${seat.used}/${seat.limit}` },
                { status: 402 }
            );
        }

        // Активируем участника и стираем токен
        m.status = 'active';
        m.inviteToken = undefined;
        m.inviteExpiresAt = undefined;
        await m.save();

        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

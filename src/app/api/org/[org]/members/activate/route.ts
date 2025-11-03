// app/api/org/[org]/members/activate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import Organization from '@/app/models/OrganizationModel';
import Membership from '@/app/models/MembershipModel';
import { ensureSeatAvailable } from '@/utils/seats';
import { Types } from 'mongoose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(err: unknown) {
    return err instanceof Error ? err.message : 'Server error';
}

// Явно описываем lean-тип организации
type OrgLean = {
    _id: Types.ObjectId;
    orgSlug: string;
};

export async function POST(_req: NextRequest, ctx: { params: Promise<{ org: string }> }) {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;

        const me = await currentUser();
        const email = me?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        // Указываем дженерик для lean, чтобы _id был Types.ObjectId
        const org = await Organization.findOne({ orgSlug }, { _id: 1, orgSlug: 1 }).lean<OrgLean>();
        if (!org) return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });

        const member = await Membership.findOne({ orgId: org._id, userEmail: email });
        if (!member) return NextResponse.json({ error: 'Вы не приглашены в эту организацию' }, { status: 403 });

        if (member.status === 'active') {
            return NextResponse.json({ ok: true, alreadyActive: true });
        }

        const seat = await ensureSeatAvailable(org._id);
        if (!seat.ok) {
            return NextResponse.json(
                { error: `Достигнут лимит мест: ${seat.used}/${seat.limit}` },
                { status: 402 }
            );
        }

        member.status = 'active';
        await member.save();

        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

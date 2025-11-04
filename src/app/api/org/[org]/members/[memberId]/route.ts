// app/api/org/[org]/members/[memberId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import Membership from '@/app/models/MembershipModel';
import { requireOrgRole } from '@/app/utils/permissions';
import { Types } from 'mongoose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(err: unknown) { return err instanceof Error ? err.message : 'Server error'; }

export async function DELETE(
    _req: NextRequest, // ← помечаем как неиспользуемый
    ctx: { params: Promise<{ org: string; memberId: string }> }
) {
    try {
        await dbConnect();
        const { org: orgSlug, memberId } = await ctx.params;

        // авторизация
        const me = await currentUser();
        const meEmail = me?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
        if (!meEmail) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        // доступ: только owner и org_admin
        const { org } = await requireOrgRole(orgSlug, meEmail, ['owner', 'org_admin']);

        if (!Types.ObjectId.isValid(memberId)) {
            return NextResponse.json({ error: 'Некорректный memberId' }, { status: 400 });
        }

        const m = await Membership.findOne({ _id: memberId, orgId: org._id });
        if (!m) return NextResponse.json({ error: 'Участник не найден' }, { status: 404 });

        // нельзя удалить владельца
        if (m.role === 'owner') {
            return NextResponse.json({ error: 'Нельзя удалить владельца организации' }, { status: 403 });
        }

        await Membership.deleteOne({ _id: m._id });
        return NextResponse.json({ ok: true });
    } catch (e) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

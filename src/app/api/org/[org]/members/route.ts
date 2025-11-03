// src/app/api/org/[org]/members/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import Membership, { OrgRole } from '@/app/models/MembershipModel';
import { requireOrgRole } from '@/app/utils/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Server error';
}

type MemberDTO = {
    _id: string;
    orgSlug: string;
    userEmail: string;
    userName?: string;
    role: OrgRole;
    status: 'active' | 'invited';
};

type MembersResponse = { members: MemberDTO[] } | { error: string };
type AddMemberBody = { userEmail: string; userName?: string; role?: OrgRole };
type AddMemberResponse = { ok: true; member: MemberDTO } | { error: string };

type MembershipLean = {
    _id: unknown;
    userEmail: string;
    userName?: string;
    role: OrgRole;
    status: 'active' | 'invited';
};

function toMemberDTO(doc: MembershipLean, orgSlug: string): MemberDTO {
    return {
        _id: String(doc._id),
        orgSlug,
        userEmail: doc.userEmail,
        userName: doc.userName,
        role: doc.role,
        status: doc.status,
    };
}

// GET /api/org/:org/members?role=executor&status=active
export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<MembersResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;

        const me = await currentUser();
        const email = me?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        // Доступ читают все участники организации
        const { org } = await requireOrgRole(orgSlug, email, [
            'owner',
            'org_admin',
            'manager',
            'executor',
            'viewer',
        ]);

        // Параметры фильтрации
        const url = new URL(req.url);
        const roleParam = url.searchParams.get('role')?.toLowerCase() as OrgRole | undefined;
        const statusParam = (url.searchParams.get('status') ?? 'active').toLowerCase() as
            | 'active'
            | 'invited';

        const allowedRoles: OrgRole[] = ['owner', 'org_admin', 'manager', 'executor', 'viewer'];
        const filter: Record<string, unknown> = { orgId: org._id };

        if (roleParam) {
            if (!allowedRoles.includes(roleParam)) {
                return NextResponse.json(
                    { error: `Unknown role: ${roleParam}` },
                    { status: 400 }
                );
            }
            filter.role = roleParam;
        }

        if (statusParam && !['active', 'invited'].includes(statusParam)) {
            return NextResponse.json({ error: `Unknown status: ${statusParam}` }, { status: 400 });
        }
        if (statusParam) filter.status = statusParam;

        const membersRaw = await Membership.find(filter)
            .lean<MembershipLean[]>()
            .sort({ userName: 1, userEmail: 1 });

        const members = membersRaw.map((m) => toMemberDTO(m, org.orgSlug));

        return NextResponse.json({ members });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

// POST /api/org/:org/members — добавить участника
export async function POST(
    request: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<AddMemberResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;

        const me = await currentUser();
        const email = me?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        // Добавлять участников могут только owner/org_admin
        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin']);

        const body = (await request.json()) as AddMemberBody;
        const userEmail = body.userEmail?.toLowerCase();
        const userName = body.userName?.trim();
        if (!userEmail) {
            return NextResponse.json({ error: 'userEmail обязателен' }, { status: 400 });
        }

        const allowed: OrgRole[] = ['org_admin', 'manager', 'executor', 'viewer'];
        const roleToSet: OrgRole = (allowed.includes(body.role as OrgRole)
            ? (body.role as OrgRole)
            : 'viewer');

        await Membership.findOneAndUpdate(
            { orgId: org._id, userEmail },
            {
                $setOnInsert: {
                    userName: userName || userEmail,
                    role: roleToSet,
                    status: 'active',
                },
            },
            { upsert: true, new: true }
        );

        const saved = await Membership.findOne({ orgId: org._id, userEmail }).lean<MembershipLean | null>();
        if (!saved) {
            return NextResponse.json({ error: 'Не удалось сохранить участника' }, { status: 500 });
        }

        const member = toMemberDTO(saved, org.orgSlug);
        return NextResponse.json({ ok: true, member });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

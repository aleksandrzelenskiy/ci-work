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

// GET /api/org/:org/members
export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<MembersResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager', 'executor', 'viewer']);

        const membersRaw = await Membership.find({ orgId: org._id }).lean<MembershipLean[]>();
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
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin']);

        const body = (await request.json()) as AddMemberBody;
        const { userEmail, userName, role } = body;
        if (!userEmail) return NextResponse.json({ error: 'userEmail обязателен' }, { status: 400 });

        const allowed: OrgRole[] = ['org_admin', 'manager', 'executor', 'viewer'];
        const roleToSet: OrgRole = allowed.includes(role as OrgRole) ? (role as OrgRole) : 'viewer';

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

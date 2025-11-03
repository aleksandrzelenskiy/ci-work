// src/app/api/org/[org]/subscription/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import Subscription from '@/app/models/SubscriptionModel';
import { requireOrgRole } from '@/app/utils/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Server error';
}

type Plan = 'free' | 'basic' | 'pro' | 'enterprise';
type SubStatus = 'active' | 'trial' | 'suspended' | 'past_due' | 'inactive';

type ISODateString = string;

type SubscriptionDTO = {
    orgSlug: string;
    plan: Plan;
    status: SubStatus;
    seats?: number;
    projectsLimit?: number;
    periodStart?: ISODateString | null;
    periodEnd?: ISODateString | null;
    note?: string;
    updatedByEmail?: string;
    updatedAt: ISODateString;
};

type GetSubResponse = { subscription: SubscriptionDTO } | { error: string };

type PatchBody = Partial<
    Pick<
        SubscriptionDTO,
        'plan' | 'status' | 'seats' | 'projectsLimit' | 'periodStart' | 'periodEnd' | 'note'
    >
>;
type PatchSubResponse = { ok: true; subscription: SubscriptionDTO } | { error: string };

/** Lean-документ подписки, возвращаемый .lean() */
interface SubscriptionLean {
    plan: Plan;
    status: SubStatus;
    seats?: number;
    projectsLimit?: number;
    periodStart?: Date | string | null;
    periodEnd?: Date | string | null;
    note?: string;
    updatedByEmail?: string;
    updatedAt?: Date | string;
    createdAt?: Date | string;
}

/** Привести любую дату (Date | string | undefined | null) к ISO или null */
function toISO(d: Date | string | undefined | null): ISODateString | null {
    if (!d) return null;
    try {
        return (d instanceof Date ? d : new Date(d)).toISOString();
    } catch {
        return null;
    }
}

/** Маппер Lean -> DTO */
function toSubscriptionDTO(doc: SubscriptionLean, orgSlug: string): SubscriptionDTO {
    return {
        orgSlug,
        plan: doc.plan,
        status: doc.status,
        seats: doc.seats,
        projectsLimit: doc.projectsLimit,
        periodStart: toISO(doc.periodStart),
        periodEnd: toISO(doc.periodEnd),
        note: doc.note,
        updatedByEmail: doc.updatedByEmail,
        updatedAt: toISO(doc.updatedAt ?? doc.createdAt) ?? new Date().toISOString(),
    };
}

/** Фоллбек DTO, когда записи ещё нет */
function fallbackDTO(orgSlug: string): SubscriptionDTO {
    return {
        orgSlug,
        plan: 'free',
        status: 'inactive',
        seats: 10,
        projectsLimit: 10,
        periodStart: null,
        periodEnd: null,
        note: 'not configured',
        updatedAt: new Date().toISOString(),
    };
}

// GET /api/org/:org/subscription — получить подписку (видно любому члену)
export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<GetSubResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager', 'executor', 'viewer']);

        const sub = await Subscription.findOne({ orgId: org._id }).lean<SubscriptionLean>();
        if (!sub) return NextResponse.json({ subscription: fallbackDTO(org.orgSlug) });

        return NextResponse.json({ subscription: toSubscriptionDTO(sub, org.orgSlug) });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

// PATCH /api/org/:org/subscription — обновить подписку (owner/org_admin)
export async function PATCH(
    request: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<PatchSubResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin']);

        const body = (await request.json()) as PatchBody;

        /** Тип обновляемых полей в БД */
        type Updatable = {
            plan?: Plan;
            status?: SubStatus;
            seats?: number;
            projectsLimit?: number;
            periodStart?: Date | string | null;
            periodEnd?: Date | string | null;
            note?: string;
            updatedByEmail: string;
            updatedAt: Date;
        };

        const update: Updatable = {
            ...('plan' in body ? { plan: body.plan } : {}),
            ...('status' in body ? { status: body.status } : {}),
            ...('seats' in body ? { seats: body.seats } : {}),
            ...('projectsLimit' in body ? { projectsLimit: body.projectsLimit } : {}),
            ...('periodStart' in body ? { periodStart: body.periodStart ?? null } : {}),
            ...('periodEnd' in body ? { periodEnd: body.periodEnd ?? null } : {}),
            ...('note' in body ? { note: body.note } : {}),
            updatedByEmail: email,
            updatedAt: new Date(),
        };

        const saved = await Subscription.findOneAndUpdate(
            { orgId: org._id },
            { $set: update },
            { upsert: true, new: true }
        ).lean<SubscriptionLean>();

        if (!saved) return NextResponse.json({ error: 'Не удалось обновить подписку' }, { status: 500 });

        return NextResponse.json({ ok: true, subscription: toSubscriptionDTO(saved, org.orgSlug) });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

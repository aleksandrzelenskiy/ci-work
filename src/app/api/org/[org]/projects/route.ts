// src/app/api/org/[org]/projects/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import Project from '@/app/models/ProjectModel';
import Subscription from '@/app/models/SubscriptionModel';
import { requireOrgRole } from '@/app/utils/permissions';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';
import { OPERATORS } from '@/app/utils/operators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toHttpError(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Организация не найдена|Org not found/i.test(msg)) return NextResponse.json({ error: 'Org not found' }, { status: 404 });
    if (/Нет членства|Недостаточно прав|Forbidden/i.test(msg)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
}

type ProjectDTO = {
    _id: string;
    name: string;
    key: string;
    description?: string;
    managers?: string[];
    managerEmail?: string | null;
    regionCode: string;
    operator: string;
};

type ProjectsResponse = { projects: ProjectDTO[] } | { error: string };
type CreateProjectBody = {
    name: string;
    key: string;
    description?: string;
    regionCode: string;
    operator: string;
};
type CreateProjectResponse = { ok: true; project: ProjectDTO } | { error: string };

// Lean-тип для документов проекта
interface ProjectLean {
    _id: string | { toString(): string };
    name: string;
    key: string;
    description?: string;
    managers?: string[];
    regionCode: string;
    operator: string;
}

export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<ProjectsResponse>> {
    try {
        await dbConnect();

        const { org } = await ctx.params;
        const orgSlug = org?.trim().toLowerCase();

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org: orgDoc } = await requireOrgRole(
            orgSlug,
            email,
            ['owner', 'org_admin', 'manager', 'executor', 'viewer']
        );

        const rows = await Project.find(
            { orgId: orgDoc._id },
            { name: 1, key: 1, description: 1, managers: 1, regionCode: 1, operator: 1 }
        ).lean<ProjectLean[]>();

        const projects: ProjectDTO[] = rows.map((p: ProjectLean) => {
            const managers = Array.isArray(p.managers) ? p.managers : [];
            return {
                _id: typeof p._id === 'string' ? p._id : p._id.toString(),
                name: p.name,
                key: p.key,
                description: p.description,
                managers,
                managerEmail: managers[0] ?? null,
                regionCode: p.regionCode,
                operator: p.operator,
            };
        });

        return NextResponse.json({ projects });
    } catch (e) {
        return toHttpError(e);
    }
}

export async function POST(
    request: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<CreateProjectResponse>> {
    try {
        await dbConnect();

        const { org } = await ctx.params;
        const orgSlug = org?.trim().toLowerCase();

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org: orgDoc } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager']);

        const sub = await Subscription.findOne({ orgId: orgDoc._id }).lean();
        if (sub && sub.status !== 'active' && sub.status !== 'trial') {
            return NextResponse.json({ error: 'Тариф не активен' }, { status: 402 });
        }

        const body = (await request.json()) as CreateProjectBody;
        const name = body?.name?.trim();
        const key = body?.key?.trim();
        const isValidRegion = RUSSIAN_REGIONS.some((region) => region.code === body.regionCode);
        const isValidOperator = OPERATORS.some((operator) => operator.value === body.operator);

        if (!name || !key || !isValidRegion || !isValidOperator) {
            return NextResponse.json({ error: 'Укажите name, key, regionCode и operator' }, { status: 400 });
        }

        const created = await Project.create({
            orgId: orgDoc._id,
            name,
            key: key.toUpperCase(),
            description: body?.description,
            managers: [email],
            createdByEmail: email,
            regionCode: body.regionCode,
            operator: body.operator,
        });

        // Извлекаем managers
        const createdManagers: string[] = Array.isArray((created as { managers?: unknown }).managers)
            ? ((created as { managers?: unknown }).managers as string[])
            : [email];

        const project: ProjectDTO = {
            _id: String(created._id),
            name: created.name,
            key: created.key,
            description: created.description,
            managers: createdManagers,
            managerEmail: createdManagers[0] ?? email,
            regionCode: created.regionCode,
            operator: created.operator,
        };

        return NextResponse.json({ ok: true, project });
    } catch (e) {
        return toHttpError(e);
    }
}

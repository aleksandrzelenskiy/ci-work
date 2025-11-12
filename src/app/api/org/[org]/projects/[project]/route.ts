// src/app/api/org/[org]/projects/[project]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import Project from '@/app/models/ProjectModel';
import { requireOrgRole } from '@/app/utils/permissions';
import { Types } from 'mongoose';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';
import { OPERATORS } from '@/app/utils/operators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Server error';
}

type ProjectDTO = {
    _id: string;
    name: string;
    key: string;
    description?: string;
    regionCode: string;
    operator: string;
};

type UpdateBody = {
    name?: string;
    key?: string;
    description?: string;
    regionCode?: string;
    operator?: string;
};
type UpdateResponse = { ok: true; project: ProjectDTO } | { error: string };
type GetResponse = { ok: true; project: ProjectDTO } | { error: string };
type DeleteResponse = { ok: true } | { error: string };

type ProjectLean = {
    _id: Types.ObjectId | string;
    name: string;
    key: string;
    description?: string;
    regionCode: string;
    operator: string;
};

function getProjectMatch(projectRef: string, orgId: Types.ObjectId) {
    const isId = Types.ObjectId.isValid(projectRef);
    return isId
        ? { _id: projectRef, orgId }
        : { key: String(projectRef).toUpperCase().trim(), orgId };
}

function toProjectDto(doc: ProjectLean): ProjectDTO {
    return {
        _id: String(doc._id),
        name: doc.name,
        key: doc.key,
        description: doc.description,
        regionCode: doc.regionCode,
        operator: doc.operator,
    };
}

/**
 * GET /api/org/:org/projects/:project — получить проект (любой член организации)
 */
export async function GET(
    _request: NextRequest,
    ctx: { params: Promise<{ org: string; project: string }> }
): Promise<NextResponse<GetResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug, project } = await ctx.params;

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, [
            'owner',
            'org_admin',
            'manager',
            'executor',
            'viewer',
        ]);

        const match = getProjectMatch(project, org._id);
        const found = await Project.findOne(match).lean<ProjectLean | null>();

        if (!found) {
            return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
        }

        return NextResponse.json({ ok: true, project: toProjectDto(found) });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

/**
 * PATCH /api/org/:org/projects/:project — обновить проект (owner/org_admin/manager)
 * :project — либо ObjectId, либо ключ проекта (key),
 */
export async function PATCH(
    request: NextRequest,
    ctx: { params: Promise<{ org: string; project: string }> }
): Promise<NextResponse<UpdateResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug, project } = await ctx.params;

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        // права (manager и выше)
        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager']);

        const body = (await request.json()) as UpdateBody;
        const update: Record<string, unknown> = {};

        if (typeof body.name === 'string') update.name = body.name.trim();
        if (typeof body.key === 'string') update.key = body.key.trim().toUpperCase(); // нормализуем KEY
        if (typeof body.description === 'string') update.description = body.description;

        if (typeof body.regionCode === 'string') {
            if (!RUSSIAN_REGIONS.some((region) => region.code === body.regionCode)) {
                return NextResponse.json({ error: 'Некорректный регион' }, { status: 400 });
            }
            update.regionCode = body.regionCode;
        }

        if (typeof body.operator === 'string') {
            if (!OPERATORS.some((operator) => operator.value === body.operator)) {
                return NextResponse.json({ error: 'Некорректный оператор' }, { status: 400 });
            }
            update.operator = body.operator;
        }

        if (Object.keys(update).length === 0) {
            return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 });
        }

        // --- главная смена логики поиска проекта ---
        const match = getProjectMatch(project, org._id);

        const updated = await Project.findOneAndUpdate(match, { $set: update }, { new: true }).lean<ProjectLean | null>();

        if (!updated) {
            return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
        }

        return NextResponse.json({ ok: true, project: toProjectDto(updated) });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

/**
 * DELETE /api/org/:org/projects/:project — удалить проект (owner/org_admin/manager)
 * :project — либо ObjectId, либо ключ проекта (key)
 */
export async function DELETE(
    _request: NextRequest,
    ctx: { params: Promise<{ org: string; project: string }> }
): Promise<NextResponse<DeleteResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug, project } = await ctx.params;

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        // права (manager и выше)
        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager']);

        const match = getProjectMatch(project, org._id);

        const deleted = await Project.findOneAndDelete(match).lean();

        if (!deleted) {
            return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

// src/app/api/org/[org]/projects/[project]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import Project from '@/app/models/ProjectModel';
import { requireOrgRole } from '@/app/utils/permissions';
import { Types } from 'mongoose';

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
};

type UpdateBody = { name?: string; key?: string; description?: string };
type UpdateResponse = { ok: true; project: ProjectDTO } | { error: string };
type DeleteResponse = { ok: true } | { error: string };

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

        if (Object.keys(update).length === 0) {
            return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 });
        }

        // --- главная смена логики поиска проекта ---
        const isId = Types.ObjectId.isValid(project);
        const match = isId
            ? { _id: project, orgId: org._id }
            : { key: String(project).toUpperCase().trim(), orgId: org._id };

        const updated = await Project.findOneAndUpdate(match, { $set: update }, { new: true }).lean();

        if (!updated) {
            return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
        }

        const dto: ProjectDTO = {
            _id: String(updated._id),
            name: updated.name,
            key: updated.key,
            description: updated.description,
        };

        return NextResponse.json({ ok: true, project: dto });
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

        const isId = Types.ObjectId.isValid(project);
        const match = isId
            ? { _id: project, orgId: org._id }
            : { key: String(project).toUpperCase().trim(), orgId: org._id };

        const deleted = await Project.findOneAndDelete(match).lean();

        if (!deleted) {
            return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

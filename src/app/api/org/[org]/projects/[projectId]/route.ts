// src/app/api/org/[org]/projects/[projectId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import Project from '@/app/models/ProjectModel';
import { requireOrgRole } from '@/app/utils/permissions';

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

// PATCH /api/org/:org/projects/:projectId — обновить проект (owner/org_admin/manager)
export async function PATCH(
    request: NextRequest,
    ctx: { params: Promise<{ org: string; projectId: string }> }
): Promise<NextResponse<UpdateResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug, projectId } = await ctx.params;

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        // права (manager и выше)
        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager']);

        const body = (await request.json()) as UpdateBody;
        const update: Record<string, unknown> = {};

        if (typeof body.name === 'string') update.name = body.name.trim();
        if (typeof body.key === 'string') update.key = body.key.trim().toUpperCase();
        if (typeof body.description === 'string') update.description = body.description;

        if (Object.keys(update).length === 0) {
            return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 });
        }

        const updated = await Project.findOneAndUpdate(
            { _id: projectId, orgId: org._id },
            { $set: update },
            { new: true }
        ).lean();

        if (!updated) {
            return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
        }

        const project: ProjectDTO = {
            _id: String(updated._id),
            name: updated.name,
            key: updated.key,
            description: updated.description,
        };

        return NextResponse.json({ ok: true, project });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

// DELETE /api/org/:org/projects/:projectId — удалить проект (owner/org_admin/manager)
export async function DELETE(
    _request: NextRequest,
    ctx: { params: Promise<{ org: string; projectId: string }> }
): Promise<NextResponse<DeleteResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug, projectId } = await ctx.params;

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        // права (manager и выше)
        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager']);

        const deleted = await Project.findOneAndDelete({ _id: projectId, orgId: org._id }).lean();

        if (!deleted) {
            return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
        }

        // Если потребуется каскадное удаление задач/файлов — добавь здесь.
        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

// src/app/api/org/[org]/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import Organization from '@/app/models/OrganizationModel';
import Project from '@/app/models/ProjectModel';
import Subscription from '@/app/models/SubscriptionModel';
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
    managers?: string[];           // список e-mail менеджеров
    managerEmail?: string | null;  // первый менеджер (для UI)
};

type ProjectsResponse = { projects: ProjectDTO[] } | { error: string };
type CreateProjectBody = { name: string; key: string; description?: string };
type CreateProjectResponse = { ok: true; project: ProjectDTO } | { error: string };

// Тип для lean-документа проекта из Mongo
interface ProjectLean {
    _id: string | { toString(): string };
    name: string;
    key: string;
    description?: string;
    managers?: string[];
}

// GET /api/org/:org/projects — список проектов
export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<ProjectsResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        // доступ любому члену организации
        await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager', 'executor', 'viewer']);

        const org = await Organization.findOne({ slug: orgSlug }).lean();
        if (!org) return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });

        const projectsRaw = await Project.find({ orgId: org._id }).lean<ProjectLean[]>();

        const projects: ProjectDTO[] = projectsRaw.map((p) => {
            const id = typeof p._id === 'string' ? p._id : p._id.toString();
            const managers = Array.isArray(p.managers) ? p.managers : [];
            const managerEmail = managers.length > 0 ? managers[0] : null;

            return {
                _id: String(id),
                name: p.name,
                key: p.key,
                description: p.description,
                managers,
                managerEmail,
            };
        });

        return NextResponse.json({ projects });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

// POST /api/org/:org/projects — создать проект (owner/org_admin/manager)
export async function POST(
    request: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<CreateProjectResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        // права (manager и выше)
        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager']);

        const sub = await Subscription.findOne({ orgId: org._id }).lean();
        if (sub && sub.status !== 'active' && sub.status !== 'trial') {
            return NextResponse.json({ error: 'Тариф не активен' }, { status: 402 });
        }

        const body = (await request.json()) as CreateProjectBody;
        const { name, key, description } = body;
        if (!name || !key) {
            return NextResponse.json({ error: 'name и key обязательны' }, { status: 400 });
        }

        // по умолчанию менеджер — создатель
        const created = await Project.create({
            orgId: org._id,
            name: name.trim(),
            key: key.trim().toUpperCase(),
            description,
            managers: [email],
            createdByEmail: email,
        });

        const createdManagers = (created as { managers?: string[] }).managers;
        const managers = Array.isArray(createdManagers) ? createdManagers : [email];
        const managerEmail = managers.length > 0 ? managers[0] : email;

        const project: ProjectDTO = {
            _id: String(created._id),
            name: created.name,
            key: created.key,
            description: created.description,
            managers,
            managerEmail,
        };

        return NextResponse.json({ ok: true, project });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

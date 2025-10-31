// src/app/api/org/[org]/projects/[projectId]/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import Organization from '@/app/models/OrganizationModel';
import Project from '@/app/models/ProjectModel';
import TaskModel from '@/app/models/TaskModel';
import { Types } from 'mongoose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Server error';
}

// noinspection SpellCheckingInspection
const TASK_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genTaskId(len = 5) {
    let s = '';
    for (let i = 0; i < len; i++) s += TASK_ID_ALPHABET[Math.floor(Math.random() * TASK_ID_ALPHABET.length)];
    return s;
}

async function getOrgAndProject(orgSlug: string, projectId: string) {
    const orgDoc = await Organization.findOne({ slug: orgSlug }).select('_id slug name');
    if (!orgDoc) return { error: 'Org not found' as const };
    const projectDoc = await Project.findOne({ _id: projectId, orgId: orgDoc._id }).select('_id name orgId');
    if (!projectDoc) return { error: 'Project not found' as const };
    return { orgDoc, projectDoc };
}

type TaskFilter = {
    orgId: Types.ObjectId;
    projectId: Types.ObjectId;
    status?: string;
    createdAt?: { $gte?: Date; $lte?: Date };
    $or?: Array<
        | { taskName: { $regex: string; $options: 'i' } }
        | { bsNumber: { $regex: string; $options: 'i' } }
        | { taskId: { $regex: string; $options: 'i' } }
    >;
};

type CreateTaskBody = {
    taskId?: string;
    taskName: string;
    bsNumber?: string;
    bsAddress?: string;
    bsLocation?: Array<{ name: string; coordinates: string }>;
    totalCost?: number;
    workItems?: unknown[];
    status?: string;
    assignees?: unknown[];
    priority?: 'urgent' | 'high' | 'medium' | 'low';
    dueDate?: string; // ISO
    [extra: string]: unknown;
};

/**
 * GET /api/org/[org]/projects/[projectId]/tasks
 * ?page=&limit=&q=&status=&from=&to=&sort=
 */
export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ org: string; projectId: string }> }
) {
    try {
        await dbConnect();
        const user = await currentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { org, projectId } = await ctx.params;

        const { searchParams } = new URL(req.url);
        const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100);
        const q = (searchParams.get('q') || '').trim();
        const status = (searchParams.get('status') || '').trim();
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const sortParam = (searchParams.get('sort') || '-createdAt').trim();

        const rel = await getOrgAndProject(org, projectId);
        if ('error' in rel) return NextResponse.json({ error: rel.error }, { status: 404 });

        // Явно формируем ObjectId
        const orgObjId = new Types.ObjectId(String(rel.orgDoc!._id));
        const projectObjId = new Types.ObjectId(String(rel.projectDoc!._id));

        const filter: TaskFilter = { orgId: orgObjId, projectId: projectObjId };

        if (q) {
            filter.$or = [
                { taskName: { $regex: q, $options: 'i' } },
                { bsNumber: { $regex: q, $options: 'i' } },
                { taskId: { $regex: q, $options: 'i' } },
            ];
        }
        if (status) filter.status = status;
        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) filter.createdAt.$lte = new Date(to);
        }

        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            TaskModel.find(filter).sort(sortParam).skip(skip).limit(limit).lean(),
            TaskModel.countDocuments(filter),
        ]);

        return NextResponse.json({ ok: true, page, limit, total, items });
    } catch (err) {
        return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
    }
}

/**
 * POST /api/org/[org]/projects/[projectId]/tasks
 * Body: CreateTaskBody (см. тип выше)
 */
export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ org: string; projectId: string }> }
) {
    try {
        await dbConnect();
        const user = await currentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { org, projectId } = await ctx.params;

        let body: CreateTaskBody;
        try {
            body = (await req.json()) as CreateTaskBody;
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const rel = await getOrgAndProject(org, projectId);
        if ('error' in rel) return NextResponse.json({ error: rel.error }, { status: 404 });

        const orgObjId = new Types.ObjectId(String(rel.orgDoc!._id));
        const projectObjId = new Types.ObjectId(String(rel.projectDoc!._id));

        const {
            taskId,
            taskName,
            bsNumber,
            bsAddress,
            bsLocation,
            totalCost,
            workItems,
            status,
            assignees,
            priority,
            dueDate,
            ...rest
        } = body;

        if (!taskName) {
            return NextResponse.json({ error: 'taskName is required' }, { status: 400 });
        }

        const created = await TaskModel.create({
            orgId: orgObjId,
            projectId: projectObjId,

            taskId: taskId || genTaskId(),
            taskName,
            bsNumber,
            bsAddress,
            bsLocation,
            totalCost,
            workItems,
            status,
            assignees,
            priority,
            dueDate, // сохраняем ISO-дату, если модель это поддерживает

            createdBy: {
                clerkId: user.id,
                email: user.emailAddresses?.[0]?.emailAddress,
                name: user.fullName || user.username || 'User',
            },

            ...rest,
        });

        return NextResponse.json({ ok: true, task: created }, { status: 201 });
    } catch (err) {
        return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
    }
}

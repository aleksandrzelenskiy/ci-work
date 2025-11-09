// src/app/api/org/[org]/projects/[project]/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import { Types } from 'mongoose';
import { getOrgAndProjectByRef } from '../_helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Server error';
}

const TASK_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genTaskId(len = 5) {
    let s = '';
    for (let i = 0; i < len; i++) s += TASK_ID_ALPHABET[Math.floor(Math.random() * TASK_ID_ALPHABET.length)];
    return s;
}

function normalizeStatus(input?: string) {
    if (!input) return 'To do';
    const s = input.trim().toLowerCase();
    if (['to do', 'todo', 'to_do', 'to-do'].includes(s)) return 'To do';
    if (s === 'assigned') return 'Assigned';
    if (['in progress', 'in_progress', 'at work'].includes(s)) return 'At work';
    if (s === 'done') return 'Done';
    if (s === 'pending') return 'Pending';
    if (['issues', 'blocked', 'problem'].includes(s)) return 'Issues';
    if (s === 'fixed') return 'Fixed';
    if (['agreed', 'approved'].includes(s)) return 'Agreed';
    return 'To do';
}

const SAFE_SORT_FIELDS = new Set([
    'createdAt',
    'updatedAt',
    'dueDate',
    'priority',
    'status',
    'taskId',
    'taskName',
]);

function sanitizeSortParam(raw: string) {
    const field = raw.replace(/^-/, '');
    if (!SAFE_SORT_FIELDS.has(field)) return '-createdAt';
    return raw.startsWith('-') ? `-${field}` : field;
}

type CreateTaskBody = {
    taskId?: string;
    taskName: string;
    bsNumber?: string;
    bsAddress?: string;
    bsLocation?: Array<{ name: string; coordinates: string }>;
    totalCost?: number | string;
    workItems?: unknown[];
    status?: string;
    priority?: 'urgent' | 'high' | 'medium' | 'low';
    dueDate?: string;
    taskType?: 'construction' | 'installation' | 'document';
    requiredAttachments?: Array<'photo' | 'pdf' | 'doc' | 'xlsm' | 'xlsx' | 'dwg'>;
    orderUrl?: string;
    orderNumber?: string;
    orderDate?: string;
    orderSignDate?: string;
    taskDescription?: string;
    executorId?: string;
    executorName?: string;
    executorEmail?: string;
    [extra: string]: unknown;
};

export async function GET(
    req: NextRequest,
    ctx: { params: Promise<{ org: string; project: string }> }
) {
    try {
        await dbConnect();
        const user = await currentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { org, project } = await ctx.params;

        const rel = await getOrgAndProjectByRef(org, project);
        if ('error' in rel) {
            console.warn('[GET tasks] not found:', { org, project, reason: rel.error });
            return NextResponse.json({ error: rel.error }, { status: 404 });
        }

        const orgObjId = new Types.ObjectId(String(rel.orgDoc!._id));
        const projectObjId = new Types.ObjectId(String(rel.projectDoc!._id));

        const { searchParams } = new URL(req.url);
        const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100);
        const q = (searchParams.get('q') || '').trim();
        const statusRaw = (searchParams.get('status') || '').trim();
        const from = searchParams.get('from');
        const to = searchParams.get('to');
        const sortParam = sanitizeSortParam((searchParams.get('sort') || '-createdAt').trim());

        const filter: Record<string, unknown> = {
            orgId: orgObjId,
            projectId: projectObjId,
        };

        if (q) {
            filter.$or = [
                { taskName: { $regex: q, $options: 'i' } },
                { bsNumber: { $regex: q, $options: 'i' } },
                { taskId: { $regex: q, $options: 'i' } },
            ];
        }
        if (statusRaw) {
            filter.status = normalizeStatus(statusRaw);
        }
        if (from || to) {
            const createdAt: Record<string, Date> = {};
            if (from) createdAt.$gte = new Date(from);
            if (to) createdAt.$lte = new Date(to);
            filter.createdAt = createdAt;
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

export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ org: string; project: string }> }
) {
    try {
        await dbConnect();
        const user = await currentUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { org, project } = await ctx.params;

        let body: CreateTaskBody;
        try {
            body = (await req.json()) as CreateTaskBody;
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
        }

        const rel = await getOrgAndProjectByRef(org, project);
        if ('error' in rel) {
            console.warn('[POST tasks] not found:', { org, project, reason: rel.error });
            return NextResponse.json({ error: rel.error }, { status: 404 });
        }

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
            priority,
            dueDate,
            taskType,
            requiredAttachments,
            orderUrl,
            orderNumber,
            orderDate,
            orderSignDate,
            taskDescription,
            executorId,
            executorName,
            executorEmail,
            ...rest
        } = body;

        if (!taskName) return NextResponse.json({ error: 'taskName is required' }, { status: 400 });
        if (!bsNumber) return NextResponse.json({ error: 'bsNumber is required' }, { status: 400 });
        if (!bsAddress) return NextResponse.json({ error: 'bsAddress is required' }, { status: 400 });

        const hasExecutor = typeof executorId === 'string' && executorId.trim().length > 0;
        const finalStatus = hasExecutor ? 'Assigned' : normalizeStatus(status);

        const creatorName =
            user.fullName || user.username || user.emailAddresses?.[0]?.emailAddress || 'User';

        // базовое событие "создано"
        const events: Array<{
            action: string;
            author: string;
            authorId: string;
            date: Date;
            details?: Record<string, unknown>;
        }> = [
            {
                action: 'created',
                author: creatorName,
                authorId: user.id,
                date: new Date(),
                details: {
                    taskName,
                    bsNumber,
                    status: finalStatus,
                    priority,
                },
            },
        ];

        // если сразу выбрали исполнителя — отдельное событие "назначена"
        if (hasExecutor) {
            events.push({
                action: 'status_changed_assigned',
                author: creatorName,
                authorId: user.id,
                date: new Date(),
                details: {
                    taskName,
                    bsNumber,
                    executorName: executorName ?? '',
                },
            });
        }

        const created = await TaskModel.create({
            orgId: orgObjId,
            projectId: projectObjId,

            taskId: taskId || genTaskId(),
            taskName,
            bsNumber,
            bsAddress,
            bsLocation,
            totalCost:
                typeof totalCost === 'number'
                    ? totalCost
                    : totalCost
                        ? Number(totalCost)
                        : undefined,
            workItems,
            status: finalStatus,
            priority,
            dueDate: dueDate ? new Date(dueDate) : undefined,

            taskType,
            requiredAttachments,
            orderUrl,
            orderNumber,
            orderDate: orderDate ? new Date(orderDate) : undefined,
            orderSignDate: orderSignDate ? new Date(orderSignDate) : undefined,
            taskDescription,

            authorId: user.id,
            authorEmail: user.emailAddresses?.[0]?.emailAddress,
            authorName: creatorName,

            executorId: hasExecutor ? executorId : undefined,
            executorName: hasExecutor ? executorName : undefined,
            executorEmail: hasExecutor ? executorEmail : undefined,

            events,

            ...rest,
        });

        return NextResponse.json({ ok: true, task: created }, { status: 201 });
    } catch (err) {
        return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
    }
}

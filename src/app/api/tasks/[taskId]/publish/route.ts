// app/api/tasks/[taskId]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import { GetUserContext } from '@/server-actions/user-context';
import { ensurePublicTaskSlot } from '@/utils/publicTasks';
import { notifyTaskPublished } from '@/app/utils/taskNotifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MANAGER_ROLES = new Set(['owner', 'org_admin', 'manager', 'super_admin']);

type Payload = {
    visibility?: 'private' | 'public';
    publicStatus?: 'open' | 'in_review' | 'assigned' | 'closed';
    budget?: number | null;
    publicDescription?: string | null;
    currency?: string;
    skills?: string[];
    allowInstantClaim?: boolean;
};

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;
    if (!taskId) {
        return NextResponse.json({ error: 'Некорректный идентификатор задачи' }, { status: 400 });
    }

    try {
        await dbConnect();
    } catch (error) {
        console.error('DB connect error', error);
        return NextResponse.json({ error: 'Ошибка подключения к базе' }, { status: 500 });
    }

    const context = await GetUserContext();
    if (!context.success || !context.data) {
        return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const { effectiveOrgRole, isSuperAdmin, memberships } = context.data;
    const payload = (await request.json()) as Payload;

    const taskQuery = mongoose.Types.ObjectId.isValid(taskId)
        ? { _id: new mongoose.Types.ObjectId(taskId) }
        : { taskId: taskId.toUpperCase() };

    const task = await TaskModel.findOne(taskQuery);
    if (!task) {
        return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
    }
    const wasPublic = task.visibility === 'public';
    const previousPublicStatus = task.publicStatus;

    const orgId = task.orgId?.toString();
    const isMember = orgId
        ? memberships?.some((m) => m.orgId === orgId)
        : false;
    const canManage =
        isSuperAdmin ||
        (MANAGER_ROLES.has(effectiveOrgRole ?? '') && isMember);

    if (!canManage) {
        return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }

    const update: Record<string, unknown> = {};

    if ('budget' in payload) {
        if (typeof payload.budget === 'number' && payload.budget >= 0) {
            update.budget = payload.budget;
        } else if (payload.budget === null) {
            update.budget = null;
        }
    }
    if (typeof payload.publicDescription === 'string') {
        update.publicDescription = payload.publicDescription.trim();
    }
    if (payload.currency) {
        update.currency = payload.currency;
    }
    if (Array.isArray(payload.skills)) {
        update.skills = payload.skills.map((s) => s.trim()).filter(Boolean);
    }
    if (typeof payload.allowInstantClaim === 'boolean') {
        update.allowInstantClaim = payload.allowInstantClaim;
    }
    if (payload.publicStatus) {
        update.publicStatus = payload.publicStatus;
    }
    const session = await mongoose.startSession();
    let saved: unknown = null;
    let limitError: string | undefined;

    try {
        await session.withTransaction(async () => {
            const freshTask = await TaskModel.findById(task._id).session(session);
            if (!freshTask) {
                throw new Error('TASK_NOT_FOUND');
            }

            const taskUpdate: Record<string, unknown> = { ...update };

            if (payload.visibility === 'public' && freshTask.visibility !== 'public') {
                taskUpdate.visibility = 'public';
                if (!taskUpdate.publicStatus) {
                    taskUpdate.publicStatus = 'open';
                }
            } else if (payload.visibility === 'private') {
                taskUpdate.visibility = 'private';
                taskUpdate.publicStatus = 'closed';
            }

            const targetVisibility = (taskUpdate.visibility as string | undefined) ?? freshTask.visibility;
            const targetPublicStatus = (taskUpdate.publicStatus as string | undefined) ?? freshTask.publicStatus;

            const isPublishingNow =
                targetVisibility === 'public' &&
                (freshTask.visibility !== 'public' ||
                    (freshTask.publicStatus === 'closed' && targetPublicStatus !== 'closed'));

            if (isPublishingNow) {
                const check = await ensurePublicTaskSlot(freshTask.orgId?.toString() ?? '', {
                    consume: true,
                    session,
                });
                if (!check.ok) {
                    limitError = check.reason ?? 'Лимит публичных задач исчерпан';
                    throw new Error('LIMIT_REACHED');
                }
            }

            saved = await TaskModel.findByIdAndUpdate(
                freshTask._id,
                { $set: taskUpdate },
                { new: true, session }
            );
        });
    } catch (error) {
        await session.endSession();
        if ((error as Error).message === 'LIMIT_REACHED') {
            return NextResponse.json(
                { error: limitError ?? 'Лимит публичных задач исчерпан' },
                { status: 403 }
            );
        }
        if ((error as Error).message === 'TASK_NOT_FOUND') {
            return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
        }
        console.error('Failed to update publish state', error);
        return NextResponse.json({ error: 'Не удалось обновить задачу' }, { status: 500 });
    }

    await session.endSession();

    const savedTask = saved as typeof task | null;

    const becamePublic = !wasPublic && savedTask?.visibility === 'public';
    const reopenedFromClosed =
        savedTask?.visibility === 'public' &&
        previousPublicStatus === 'closed' &&
        savedTask.publicStatus !== 'closed';

    if (savedTask && (becamePublic || reopenedFromClosed)) {
        try {
            await notifyTaskPublished({
                taskId: savedTask.taskId ?? task.taskId,
                taskMongoId: savedTask._id?.toString?.() ?? task._id?.toString?.(),
                taskName: savedTask.taskName ?? task.taskName ?? 'Задача',
                bsNumber: savedTask.bsNumber ?? task.bsNumber,
                budget: savedTask.budget ?? task.budget,
                currency: savedTask.currency ?? task.currency,
                orgId: savedTask.orgId ?? task.orgId,
                orgSlug: (savedTask as { orgSlug?: string })?.orgSlug ?? (task as { orgSlug?: string })?.orgSlug,
                orgName: (savedTask as { orgName?: string })?.orgName ?? (task as { orgName?: string })?.orgName,
                projectKey: (savedTask as { projectKey?: string })?.projectKey ?? undefined,
                projectName: (savedTask as { projectName?: string })?.projectName ?? undefined,
            });
        } catch (notifyErr) {
            console.error('Failed to notify about task publication', notifyErr);
        }
    }

    return NextResponse.json({ ok: true, task: savedTask });
}

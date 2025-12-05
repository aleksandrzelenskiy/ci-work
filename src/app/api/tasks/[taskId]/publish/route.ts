// app/api/tasks/[taskId]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import { GetUserContext } from '@/server-actions/user-context';
import { ensurePublicTaskSlot } from '@/utils/publicTasks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MANAGER_ROLES = new Set(['owner', 'org_admin', 'manager', 'super_admin']);

type Payload = {
    visibility?: 'private' | 'public';
    publicStatus?: 'open' | 'in_review' | 'assigned' | 'closed';
    budget?: number;
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

    if (typeof payload.budget === 'number' && payload.budget >= 0) {
        update.budget = payload.budget;
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

    if (payload.visibility === 'public' && task.visibility !== 'public') {
        const check = await ensurePublicTaskSlot(task.orgId?.toString() ?? '');
        if (!check.ok) {
            return NextResponse.json({ error: check.reason || 'Лимит публичных задач исчерпан' }, { status: 403 });
        }
        update.visibility = 'public';
        if (!update.publicStatus) {
            update.publicStatus = 'open';
        }
    } else if (payload.visibility === 'private') {
        update.visibility = 'private';
        update.publicStatus = 'closed';
    }

    try {
        const saved = await TaskModel.findByIdAndUpdate(
            taskId,
            { $set: update },
            { new: true }
        ).lean();
        return NextResponse.json({ ok: true, task: saved });
    } catch (error) {
        console.error('Failed to update publish state', error);
        return NextResponse.json({ error: 'Не удалось обновить задачу' }, { status: 500 });
    }
}

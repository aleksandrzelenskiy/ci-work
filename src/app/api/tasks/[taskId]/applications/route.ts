// app/api/tasks/[taskId]/applications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import ApplicationModel from '@/app/models/ApplicationModel';
import { GetUserContext } from '@/server-actions/user-context';
import type { ApplicationStatus } from '@/app/models/ApplicationModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MANAGER_ROLES = new Set(['owner', 'org_admin', 'manager', 'super_admin']);

type CreateApplicationBody = {
    coverMessage?: string;
    proposedBudget?: number;
    etaDays?: number;
    attachments?: string[];
};

type UpdateApplicationBody = {
    applicationId?: string;
    status?: ApplicationStatus;
};

async function loadTask(taskId: string) {
    if (!mongoose.Types.ObjectId.isValid(taskId)) return null;
    return TaskModel.findById(taskId).lean();
}

export async function GET(
    _request: NextRequest,
    { params }: { params: { taskId: string } }
) {
    const { taskId } = params;
    try {
        await dbConnect();
    } catch (error) {
        console.error('DB connect error', error);
        return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });
    }

    const task = await loadTask(taskId);
    if (!task) {
        return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
    }

    const context = await GetUserContext();
    if (!context.success || !context.data) {
        return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const { user, effectiveOrgRole, isSuperAdmin, memberships } = context.data;
    const orgId = task.orgId?.toString();
    const isMember = orgId ? memberships.some((m) => m.orgId === orgId) : false;
    const canViewAll =
        isSuperAdmin || (isMember && MANAGER_ROLES.has(effectiveOrgRole ?? ''));

    const query: Record<string, unknown> = { taskId: task._id };
    if (!canViewAll) {
        query.contractorId = user._id;
    }

    const applications = await ApplicationModel.find(query).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ applications });
}

export async function POST(
    request: NextRequest,
    { params }: { params: { taskId: string } }
) {
    const { taskId } = params;
    const body = (await request.json()) as CreateApplicationBody;

    try {
        await dbConnect();
    } catch (error) {
        console.error('DB connect error', error);
        return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });
    }

    const context = await GetUserContext();
    if (!context.success || !context.data) {
        return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const { user } = context.data;
    if (user.profileType !== 'contractor') {
        return NextResponse.json({ error: 'Отклики доступны только подрядчикам' }, { status: 403 });
    }

    const task = await loadTask(taskId);
    if (!task || task.visibility !== 'public') {
        return NextResponse.json({ error: 'Задача недоступна для откликов' }, { status: 404 });
    }

    const proposedBudget = typeof body.proposedBudget === 'number' ? body.proposedBudget : undefined;
    if (!proposedBudget || proposedBudget <= 0) {
        return NextResponse.json({ error: 'Укажите фиксированную ставку' }, { status: 400 });
    }
    const coverMessage = (body.coverMessage || '').trim();
    if (!coverMessage) {
        return NextResponse.json({ error: 'Добавьте сопроводительное сообщение' }, { status: 400 });
    }

    const existing = await ApplicationModel.findOne({
        taskId: task._id,
        contractorId: user._id,
    }).lean();

    if (existing) {
        return NextResponse.json({ error: 'Вы уже откликались на эту задачу' }, { status: 409 });
    }

    try {
        const app = await ApplicationModel.create({
            taskId: task._id,
            orgId: task.orgId,
            contractorId: user._id,
            contractorEmail: user.email,
            contractorName: user.name,
            coverMessage,
            proposedBudget,
            etaDays: body.etaDays,
            attachments: Array.isArray(body.attachments) ? body.attachments : [],
            status: 'submitted',
        });

        await TaskModel.findByIdAndUpdate(task._id, {
            $inc: { applicationCount: 1 },
        });

        return NextResponse.json({ ok: true, application: app.toObject() }, { status: 201 });
    } catch (error) {
        console.error('Failed to create application', error);
        return NextResponse.json({ error: 'Не удалось отправить отклик' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { taskId: string } }
) {
    const { taskId } = params;
    const body = (await request.json()) as UpdateApplicationBody;

    if (!body.applicationId || !mongoose.Types.ObjectId.isValid(body.applicationId)) {
        return NextResponse.json({ error: 'Некорректный идентификатор отклика' }, { status: 400 });
    }

    try {
        await dbConnect();
    } catch (error) {
        console.error('DB connect error', error);
        return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });
    }

    const context = await GetUserContext();
    if (!context.success || !context.data) {
        return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const { user, effectiveOrgRole, isSuperAdmin, memberships } = context.data;

    const task = await loadTask(taskId);
    if (!task) {
        return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
    }

    const app = await ApplicationModel.findById(body.applicationId);
    if (!app || app.taskId.toString() !== task._id.toString()) {
        return NextResponse.json({ error: 'Отклик не найден' }, { status: 404 });
    }

    const orgId = task.orgId?.toString();
    const isMember = orgId ? memberships.some((m) => m.orgId === orgId) : false;
    const canManage =
        isSuperAdmin || (isMember && MANAGER_ROLES.has(effectiveOrgRole ?? ''));

    const isOwnerOfApplication = app.contractorId.toString() === user._id.toString();

    // Правила обновления статуса
    if (isOwnerOfApplication && body.status === 'withdrawn') {
        app.status = 'withdrawn';
    } else if (canManage && body.status) {
        app.status = body.status;
        if (body.status === 'accepted') {
            await TaskModel.findByIdAndUpdate(task._id, {
                $set: { publicStatus: 'assigned', acceptedApplicationId: app._id.toString() },
            });
        }
    } else {
        return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }

    await app.save();
    return NextResponse.json({ ok: true, application: app.toObject() });
}

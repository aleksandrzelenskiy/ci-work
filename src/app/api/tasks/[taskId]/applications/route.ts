// app/api/tasks/[taskId]/applications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import ApplicationModel from '@/app/models/ApplicationModel';
import { GetUserContext } from '@/server-actions/user-context';
import type { ApplicationStatus } from '@/app/models/ApplicationModel';
import UserModel from '@/app/models/UserModel';
import MembershipModel from '@/app/models/MembershipModel';
import { ensureSeatAvailable } from '@/utils/seats';

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
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;
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
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;
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
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;
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
            const contractor = await UserModel.findById(app.contractorId).lean();
            if (!contractor) {
                return NextResponse.json({ error: 'Подрядчик не найден' }, { status: 404 });
            }

            if (task.orgId && contractor.email) {
                const email = contractor.email.toLowerCase();
                const membership = await MembershipModel.findOne({
                    orgId: task.orgId,
                    userEmail: email,
                });

                if (!membership || membership.status !== 'active') {
                    const seat = await ensureSeatAvailable(task.orgId.toString());
                    if (!seat.ok) {
                        return NextResponse.json(
                            { error: `Достигнут лимит рабочих мест: ${seat.used}/${seat.limit}` },
                            { status: 402 }
                        );
                    }

                    if (membership) {
                        membership.status = 'active';
                        membership.role = membership.role || 'executor';
                        if (!membership.userName && contractor.name) {
                            membership.userName = contractor.name;
                        }
                        await membership.save();
                    } else {
                        await MembershipModel.create({
                            orgId: task.orgId,
                            userEmail: email,
                            userName: contractor.name || email,
                            role: 'executor',
                            status: 'active',
                        });
                    }
                }
            }

            const update: Record<string, unknown> = {
                publicStatus: 'assigned',
                acceptedApplicationId: app._id.toString(),
                contractorPayment: app.proposedBudget,
            };

            if (contractor.clerkUserId) {
                update.executorId = contractor.clerkUserId;
            }
            if (contractor.name) {
                update.executorName = contractor.name;
            }
            if (contractor.email) {
                update.executorEmail = contractor.email;
            }

            if (!task.status || task.status === 'To do') {
                update.status = 'Assigned';
            }

            await TaskModel.findByIdAndUpdate(task._id, {
                $set: update,
            });
        }
    } else {
        return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }

    await app.save();
    return NextResponse.json({ ok: true, application: app.toObject() });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ taskId: string }> }
) {
    const { taskId } = await params;
    const { searchParams } = new URL(request.url);
    let applicationId = searchParams.get('applicationId');

    if (!applicationId) {
        try {
            const body = (await request.json()) as { applicationId?: string };
            applicationId = body?.applicationId ?? null;
        } catch {
            applicationId = null;
        }
    }

    if (!applicationId || !mongoose.Types.ObjectId.isValid(applicationId)) {
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

    const { user } = context.data;
    const task = await loadTask(taskId);
    if (!task) {
        return NextResponse.json({ error: 'Задача не найдена' }, { status: 404 });
    }

    const app = await ApplicationModel.findById(applicationId);
    if (!app || app.taskId.toString() !== task._id.toString()) {
        return NextResponse.json({ error: 'Отклик не найден' }, { status: 404 });
    }

    const isOwner = app.contractorId.toString() === user._id.toString();
    if (!isOwner) {
        return NextResponse.json({ error: 'Недостаточно прав для удаления' }, { status: 403 });
    }

    if (app.status === 'accepted') {
        return NextResponse.json(
            { error: 'Принятый отклик нельзя удалить. Попросите менеджера переназначить задачу' },
            { status: 409 }
        );
    }

    try {
        await app.deleteOne();
        await TaskModel.findByIdAndUpdate(task._id, [
            {
                $set: {
                    applicationCount: {
                        $max: [
                            {
                                $subtract: [{ $ifNull: ['$applicationCount', 0] }, 1],
                            },
                            0,
                        ],
                    },
                },
            },
        ]);
    } catch (error) {
        console.error('Failed to delete application', error);
        return NextResponse.json({ error: 'Не удалось удалить отклик' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}

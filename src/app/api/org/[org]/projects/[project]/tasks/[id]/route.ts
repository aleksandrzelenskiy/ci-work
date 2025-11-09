// src/app/api/org/[org]/projects/[project]/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import BaseStation, { IBaseStation } from '@/app/models/BaseStation';
import { Types } from 'mongoose';
import { getOrgAndProjectByRef } from '../../_helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// универсальное сообщение об ошибке
function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Server error';
}

// карта вариантов статусов из UI в статус из схемы
const STATUS_TITLE_MAP: Record<string, string> = {
    'TO DO': 'To do',
    'TODO': 'To do',
    'TO-DO': 'To do',
    ASSIGNED: 'Assigned',
    'IN PROGRESS': 'At work',
    'IN-PROGRESS': 'At work',
    'AT WORK': 'At work',
    DONE: 'Done',
    PENDING: 'Pending',
    ISSUES: 'Issues',
    FIXED: 'Fixed',
    AGREED: 'Agreed',
};

// нормализуем статус
function normalizeStatus(input?: string): string | undefined {
    if (!input) return undefined;
    const key = input.trim().toUpperCase();
    return STATUS_TITLE_MAP[key] ?? input;
}

// нормализуем приоритет
function normalizePriority(p?: string): 'urgent' | 'high' | 'medium' | 'low' | undefined {
    if (!p) return undefined;
    const v = String(p).toLowerCase();
    if (v === 'urgent' || v === 'high' || v === 'medium' || v === 'low') return v;
    return undefined;
}

// пытаемся привести к числу
function parseMaybeNumber(v: unknown): number | undefined {
    if (v === '' || v === null || typeof v === 'undefined') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}

// пытаемся привести к дате
function parseMaybeISODate(v: unknown): Date | undefined {
    if (!v) return undefined;
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? undefined : d;
}

// приводим к ObjectId
function toObjectId(id: unknown): Types.ObjectId {
    if (id instanceof Types.ObjectId) return id;
    return new Types.ObjectId(String(id));
}

// типы из helper'а
type OrgDocLean = { _id: unknown };
type ProjectDocLean = {
    _id: unknown;
    operatorCode?: string;
    regionCode?: string;
};
type GetOrgProjectOk = { orgDoc: OrgDocLean; projectDoc: ProjectDocLean };
type GetOrgProjectErr = { error: string };

// проверяем успешный ответ
function isGetOrgProjectOk(x: unknown): x is GetOrgProjectOk {
    if (typeof x !== 'object' || x === null) return false;
    const obj = x as Record<string, unknown>;
    return 'orgDoc' in obj && 'projectDoc' in obj;
}

// извлекаем строку ошибки
function extractError(x: unknown): string | undefined {
    if (typeof x !== 'object' || x === null) return undefined;
    const maybe = x as Partial<GetOrgProjectErr>;
    return typeof maybe.error === 'string' ? maybe.error : undefined;
}

// элемент массива bsLocation
interface TaskBsLocationItem {
    name: string;
    coordinates: string;
    address?: string;
}

// строим bsLocation из документа БС
function buildBsLocationFromStation(
    bs: Pick<IBaseStation, 'coordinates' | 'address'> & { lat?: number; lon?: number },
    bsNumber: string
): TaskBsLocationItem[] {
    if (bs.coordinates) {
        return [
            {
                name: bsNumber,
                coordinates: bs.coordinates,
                address: bs.address ?? '',
            },
        ];
    }

    if (typeof bs.lat === 'number' && typeof bs.lon === 'number') {
        return [
            {
                name: bsNumber,
                coordinates: `${bs.lat} ${bs.lon}`,
                address: bs.address ?? '',
            },
        ];
    }

    return [
        {
            name: bsNumber,
            coordinates: '',
            address: bs.address ?? '',
        },
    ];
}

// получаем org/project и их ObjectId
async function requireOrgProject(
    orgSlug: string,
    projectRef: string
): Promise<
    | {
    ok: true;
    orgId: Types.ObjectId;
    projectId: Types.ObjectId;
    projectDoc: ProjectDocLean;
}
    | { ok: false; status: number; error: string }
> {
    const refUnknown = (await getOrgAndProjectByRef(orgSlug, projectRef)) as unknown;

    if (!isGetOrgProjectOk(refUnknown)) {
        return {
            ok: false,
            status: 404,
            error: extractError(refUnknown) ?? 'Org or project not found',
        };
    }

    const rawOrgId = refUnknown.orgDoc?._id;
    const rawProjectId = refUnknown.projectDoc?._id;

    if (!rawOrgId || !rawProjectId) {
        return { ok: false, status: 404, error: 'Org or project not found' };
    }

    return {
        ok: true,
        orgId: toObjectId(rawOrgId),
        projectId: toObjectId(rawProjectId),
        projectDoc: refUnknown.projectDoc,
    };
}

// собираем запрос к задаче по org/project и id|taskId
function buildTaskQuery(
    orgId: Types.ObjectId,
    projectId: Types.ObjectId,
    rawId: string
): Record<string, unknown> {
    const query: Record<string, unknown> = { orgId, projectId };
    if (Types.ObjectId.isValid(rawId)) {
        query._id = new Types.ObjectId(rawId);
    } else {
        query.taskId = rawId;
    }
    return query;
}

// DELETE /tasks/[id]
export async function DELETE(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string; project: string; id: string }> }
) {
    try {
        await dbConnect();
        const me = await currentUser();
        const email = me?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org: orgSlug, project: projectRef, id } = await ctx.params;

        const ensured = await requireOrgProject(orgSlug, projectRef);
        if (!ensured.ok) {
            return NextResponse.json({ error: ensured.error }, { status: ensured.status });
        }
        const { orgId, projectId } = ensured;

        const query = buildTaskQuery(orgId, projectId, id);

        const del = await TaskModel.deleteOne(query);

        if (del.deletedCount === 0) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
    }
}

// PUT /tasks/[id]
export async function PUT(
    req: NextRequest,
    ctx: { params: Promise<{ org: string; project: string; id: string }> }
) {
    try {
        await dbConnect();
        const me = await currentUser();
        const email = me?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org: orgSlug, project: projectRef, id } = await ctx.params;

        const ensured = await requireOrgProject(orgSlug, projectRef);
        if (!ensured.ok) {
            return NextResponse.json({ error: ensured.error }, { status: ensured.status });
        }
        const { orgId, projectId, projectDoc } = ensured;

        const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

        const taskQuery = buildTaskQuery(orgId, projectId, id);

        // текущая задача
        const currentTask = await TaskModel.findOne(taskQuery);
        if (!currentTask) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        const allowedPatch: Record<string, unknown> = {};
        const changed: Record<string, { from: unknown; to: unknown }> = {};

        // фиксируем только реально изменившиеся поля
        function markChange(field: string, from: unknown, to: unknown) {
            const same =
                (from instanceof Date && to instanceof Date && from.getTime() === to.getTime()) ||
                from === to;
            if (!same) {
                changed[field] = { from, to };
            }
        }

        // имя
        if (typeof body.taskName === 'string') {
            markChange('taskName', currentTask.taskName, body.taskName);
            allowedPatch.taskName = body.taskName;
        }

        // номер БС
        const newBsNumber =
            typeof body.bsNumber === 'string' ? (body.bsNumber as string) : currentTask.bsNumber;
        if (typeof body.bsNumber === 'string') {
            markChange('bsNumber', currentTask.bsNumber, body.bsNumber);
            allowedPatch.bsNumber = body.bsNumber;
        }

        // адрес БС
        if (typeof body.bsAddress === 'string') {
            markChange('bsAddress', currentTask.bsAddress, body.bsAddress);
            allowedPatch.bsAddress = body.bsAddress;
        }

        // описание
        if (typeof body.taskDescription === 'string') {
            const trimmed = body.taskDescription.trim();
            markChange('taskDescription', currentTask.taskDescription, trimmed || undefined);
            allowedPatch.taskDescription = trimmed || undefined;
        }

        // статус
        const status = normalizeStatus(body.status as string | undefined);
        if (status) {
            markChange('status', currentTask.status, status);
            allowedPatch.status = status;
        }

        // приоритет
        const pr = normalizePriority(body.priority as string | undefined);
        if (pr) {
            markChange('priority', currentTask.priority, pr);
            allowedPatch.priority = pr;
        }

        // срок
        const due = parseMaybeISODate(body.dueDate);
        if (due) {
            markChange(
                'dueDate',
                currentTask.dueDate ? currentTask.dueDate.toISOString() : undefined,
                due.toISOString()
            );
            allowedPatch.dueDate = due;
        }

        // доп. координаты с фронта
        const ctCoords = currentTask as unknown as { bsLatitude?: number; bsLongitude?: number };

        const lat = parseMaybeNumber(body.bsLatitude);
        if (typeof lat !== 'undefined') {
            markChange('bsLatitude', ctCoords.bsLatitude, lat);
            allowedPatch.bsLatitude = lat;
        }
        const lon = parseMaybeNumber(body.bsLongitude);
        if (typeof lon !== 'undefined') {
            markChange('bsLongitude', ctCoords.bsLongitude, lon);
            allowedPatch.bsLongitude = lon;
        }

        // сюда положим доп. события (например, назначили исполнителя)
        const extraEvents: Array<{
            action: string;
            author: string;
            authorId: string;
            date: Date;
            details?: Record<string, unknown>;
        }> = [];

// исполнитель
        if (typeof body.executorId === 'string' && body.executorId.trim()) {
            const trimmedId = body.executorId.trim();
            const hadExecutorBefore = !!currentTask.executorId;

            markChange('executorId', currentTask.executorId, trimmedId);
            allowedPatch.executorId = trimmedId;

            let newExecutorName: string | undefined;
            if (typeof body.executorName === 'string') {
                newExecutorName = body.executorName;
                markChange('executorName', currentTask.executorName, body.executorName);
                allowedPatch.executorName = body.executorName;
            }
            if (typeof body.executorEmail === 'string') {
                markChange('executorEmail', currentTask.executorEmail, body.executorEmail);
                allowedPatch.executorEmail = body.executorEmail;
            }

            // если исполнителя не было и теперь есть — пишем событие "назначена"
            if (!hadExecutorBefore) {
                extraEvents.push({
                    action: 'status_changed_assigned',
                    author: me.fullName || me.username || email,
                    authorId: me.id,
                    date: new Date(),
                    details: {
                        taskName: currentTask.taskName,
                        bsNumber: currentTask.bsNumber,
                        executorName: newExecutorName ?? currentTask.executorName ?? '',
                    },
                });
            }
        } else if (body.executorId === null) {
            // сняли исполнителя
            if (currentTask.executorId || currentTask.executorName || currentTask.executorEmail) {
                markChange('executorId', currentTask.executorId, undefined);
                markChange('executorName', currentTask.executorName, undefined);
                markChange('executorEmail', currentTask.executorEmail, undefined);
            }
            allowedPatch.executorId = undefined;
            allowedPatch.executorName = undefined;
            allowedPatch.executorEmail = undefined;
        }

        // сумма
        if (typeof body.totalCost !== 'undefined') {
            const tc = parseMaybeNumber(body.totalCost);
            const prev = typeof currentTask.totalCost === 'number' ? currentTask.totalCost : undefined;
            if (typeof tc !== 'undefined') {
                markChange('totalCost', prev, tc);
                allowedPatch.totalCost = tc;
            } else {
                markChange('totalCost', prev, undefined);
                allowedPatch.totalCost = undefined;
            }
        }

        // геолокация, которую прислал клиент
        const clientBsLocation: TaskBsLocationItem[] | null = Array.isArray(body.bsLocation)
            ? (body.bsLocation as TaskBsLocationItem[])
            : null;

        const bsNumberChanged = newBsNumber !== currentTask.bsNumber;

        const operatorCode = projectDoc.operatorCode;
        const regionCode = projectDoc.regionCode;

        // если номер БС поменялся — пытаемся подтянуть координаты из своей коллекции БС
        if (bsNumberChanged) {
            const bsQuery: {
                name: string;
                operatorCode?: string;
                regionCode?: string;
            } = { name: newBsNumber };
            if (operatorCode) bsQuery.operatorCode = operatorCode;
            if (regionCode) bsQuery.regionCode = regionCode;

            const bs = (await BaseStation.findOne(bsQuery).lean()) as
                | (IBaseStation & { lat?: number; lon?: number; address?: string })
                | null;

            if (bs) {
                const newLoc = buildBsLocationFromStation(bs, newBsNumber);
                markChange('bsLocation', currentTask.bsLocation, newLoc);
                allowedPatch.bsLocation = newLoc;
            } else if (clientBsLocation) {
                markChange('bsLocation', currentTask.bsLocation, clientBsLocation);
                allowedPatch.bsLocation = clientBsLocation;
            } else {
                markChange('bsLocation', currentTask.bsLocation, []);
                allowedPatch.bsLocation = [];
            }
        } else if (clientBsLocation) {
            // номер не менялся, но клиент прислал точки — обновим
            markChange('bsLocation', currentTask.bsLocation, clientBsLocation);
            allowedPatch.bsLocation = clientBsLocation;
        }

        const hasChanges = Object.keys(changed).length > 0;

        // формируем запрос на обновление
        const updateQuery: Record<string, unknown> = { $set: allowedPatch };

        if (hasChanges || extraEvents.length > 0) {
            updateQuery.$push = {
                events: {
                    $each: [
                        ...(hasChanges
                            ? [
                                {
                                    action: 'updated',
                                    author: me.fullName || me.username || email,
                                    authorId: me.id,
                                    date: new Date(),
                                    details: changed,
                                },
                            ]
                            : []),
                        ...extraEvents,
                    ],
                },
            };
        }

        const updated = await TaskModel.findOneAndUpdate(taskQuery, updateQuery, {
            new: true,
            lean: true,
        });

        if (!updated) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        return NextResponse.json({ ok: true, task: updated });
    } catch (err) {
        return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
    }
}

// GET /tasks/[id]
export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string; project: string; id: string }> }
) {
    try {
        await dbConnect();
        const me = await currentUser();
        const email = me?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org: orgSlug, project: projectRef, id } = await ctx.params;

        const ensured = await requireOrgProject(orgSlug, projectRef);
        if (!ensured.ok) {
            return NextResponse.json({ error: ensured.error }, { status: ensured.status });
        }
        const { orgId, projectId } = ensured;

        const taskQuery = buildTaskQuery(orgId, projectId, id);

        const taskDoc = await TaskModel.findOne(taskQuery, {}, { lean: true });

        if (!taskDoc) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        return NextResponse.json({ task: taskDoc });
    } catch (err) {
        return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
    }
}

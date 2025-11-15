// src/app/api/org/[org]/projects/[project]/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import BaseStation, { IBaseStation, ensureIrkutskT2Station, normalizeBsNumber } from '@/app/models/BaseStation';
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

function parseCoordinatesPair(value?: string | null): { lat?: number; lon?: number } {
    if (!value) return {};
    const trimmed = value.trim();
    if (!trimmed) return {};
    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) return {};
    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    return {
        lat: Number.isFinite(lat) ? Number(lat.toFixed(6)) : undefined,
        lon: Number.isFinite(lon) ? Number(lon.toFixed(6)) : undefined,
    };
}

// приводим к ObjectId
function toObjectId(id: unknown): Types.ObjectId {
    if (id instanceof Types.ObjectId) return id;
    return new Types.ObjectId(String(id));
}

// элемент массива bsLocation
interface TaskBsLocationItem {
    name: string;
    coordinates: string;
    address?: string;
}

// нормализуем bsLocation для сравнения
function normalizeBsLocation(list: TaskBsLocationItem[] | undefined | null): TaskBsLocationItem[] {
    if (!Array.isArray(list)) return [];
    return list.map((item) => ({
        name: item.name ?? '',
        coordinates: item.coordinates ?? '',
        address: item.address ?? '',
    }));
}

// аккуратное сравнение для логов
function isSameValue(a: unknown, b: unknown): boolean {
    // оба null/undefined
    if (a == null && b == null) return true;

    // спец. случай: bsLocation (массив объектов)
    const isBsLocArray = (v: unknown) =>
        Array.isArray(v) && v.every((x) => typeof x === 'object' && x !== null && 'coordinates' in x);

    if (isBsLocArray(a) && isBsLocArray(b)) {
        const na = normalizeBsLocation(a as TaskBsLocationItem[]);
        const nb = normalizeBsLocation(b as TaskBsLocationItem[]);
        return JSON.stringify(na) === JSON.stringify(nb);
    }

    // числовые/строковые координаты
    const isNumLike = (v: unknown) =>
        typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));

    if (isNumLike(a) && isNumLike(b)) {
        const na = Number(a);
        const nb = Number(b);
        return Number(na.toFixed(6)) === Number(nb.toFixed(6));
    }

    // объекты/массивы — для остальных случаев
    if (typeof a === 'object' && typeof b === 'object') {
        return JSON.stringify(a) === JSON.stringify(b);
    }

    // даты
    if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
    }

    return a === b;
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

// типы из helper'а
type OrgDocLean = { _id: unknown };
type ProjectDocLean = {
    _id: unknown;
    operator?: string;
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

        const currentTask = await TaskModel.findOne(taskQuery);
        if (!currentTask) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        const allowedPatch: Record<string, unknown> = {};
        const unsetPatch: Record<string, 1> = {};
        const changed: Record<string, { from: unknown; to: unknown }> = {};


        function markChange(field: string, from: unknown, to: unknown) {
            if (isSameValue(from, to)) return;
            changed[field] = { from, to };
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

        // --- bsLocation, БС и флаг изменения ---
        const clientBsLocation: TaskBsLocationItem[] | null = Array.isArray(body.bsLocation)
            ? (body.bsLocation as TaskBsLocationItem[])
            : null;

        const bsNumberChanged = newBsNumber !== currentTask.bsNumber;
        let bsLocationChanged = false;

        const operatorCode = projectDoc.operator;
        const regionCode = projectDoc.regionCode;

        if (bsNumberChanged) {
            // подтягиваем из своей БС
            const normalizedBs = normalizeBsNumber(newBsNumber);
            const bsQuery: Record<string, unknown> = {
                $or: [{ name: normalizedBs }, { num: normalizedBs }],
            };
            if (operatorCode) bsQuery.operatorCode = operatorCode;
            if (regionCode) bsQuery.regionCode = regionCode;

            const bs = (await BaseStation.findOne(bsQuery).lean()) as
                | (IBaseStation & { lat?: number; lon?: number; address?: string })
                | null;

            if (bs) {
                const newLoc = buildBsLocationFromStation(bs, newBsNumber);
                const prevNorm = normalizeBsLocation(currentTask.bsLocation as TaskBsLocationItem[]);
                const nextNorm = normalizeBsLocation(newLoc);
                if (!isSameValue(prevNorm, nextNorm)) {
                    markChange('bsLocation', prevNorm, nextNorm);
                    allowedPatch.bsLocation = newLoc;
                    bsLocationChanged = true;
                }
            } else if (clientBsLocation) {
                const prevNorm = normalizeBsLocation(currentTask.bsLocation as TaskBsLocationItem[]);
                const nextNorm = normalizeBsLocation(clientBsLocation);
                if (!isSameValue(prevNorm, nextNorm)) {
                    markChange('bsLocation', prevNorm, nextNorm);
                    allowedPatch.bsLocation = clientBsLocation;
                    bsLocationChanged = true;
                }
            } else {
                const prevNorm = normalizeBsLocation(currentTask.bsLocation as TaskBsLocationItem[]);
                if (!isSameValue(prevNorm, [])) {
                    markChange('bsLocation', prevNorm, []);
                    allowedPatch.bsLocation = [];
                    bsLocationChanged = true;
                }
            }
        } else if (clientBsLocation) {
            // номер не менялся, но клиент прислал — проверим реально ли другое
            const prevNorm = normalizeBsLocation(currentTask.bsLocation as TaskBsLocationItem[]);
            const nextNorm = normalizeBsLocation(clientBsLocation);
            if (!isSameValue(prevNorm, nextNorm)) {
                markChange('bsLocation', prevNorm, nextNorm);
                allowedPatch.bsLocation = clientBsLocation;
                bsLocationChanged = true;
            }
        }

        // --- координаты: только если менялся номер БС ИЛИ мы реально поменяли bsLocation ---
        const ctCoords = currentTask as unknown as { bsLatitude?: number | string; bsLongitude?: number | string };

        const lat = parseMaybeNumber(body.bsLatitude);
        if (typeof lat !== 'undefined' && (bsNumberChanged || bsLocationChanged)) {
            if (!isSameValue(ctCoords.bsLatitude, lat)) {
                markChange('bsLatitude', ctCoords.bsLatitude, lat);
                allowedPatch.bsLatitude = lat;
            }
        }

        const lon = parseMaybeNumber(body.bsLongitude);
        if (typeof lon !== 'undefined' && (bsNumberChanged || bsLocationChanged)) {
            if (!isSameValue(ctCoords.bsLongitude, lon)) {
                markChange('bsLongitude', ctCoords.bsLongitude, lon);
                allowedPatch.bsLongitude = lon;
            }
        }

        const extraEvents: Array<{
            action: string;
            author: string;
            authorId: string;
            date: Date;
            details?: Record<string, unknown>;
        }> = [];

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

            // если исполнителя не было — считаем, что задача стала Assigned
            if (!hadExecutorBefore) {
                // если в этом же запросе через body нам НЕ задали статус вручную,
                // и в задаче он пустой или To do — выставляем Assigned
                const statusAlreadySetInThisRequest = 'status' in allowedPatch;
                const currentStatus = currentTask.status;

                if (!statusAlreadySetInThisRequest && (!currentStatus || currentStatus === 'To do')) {
                    markChange('status', currentStatus, 'Assigned');
                    allowedPatch.status = 'Assigned';
                }

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
            // был исполнитель — убираем
            if (currentTask.executorId || currentTask.executorName || currentTask.executorEmail) {
                markChange('executorId', currentTask.executorId, undefined);
                markChange('executorName', currentTask.executorName, undefined);
                markChange('executorEmail', currentTask.executorEmail, undefined);
            }

            // именно удаляем поля
            unsetPatch.executorId = 1;
            unsetPatch.executorName = 1;
            unsetPatch.executorEmail = 1;

            // если статус был Assigned и в этом запросе его не поменяли явно — откатываем в To do
            const statusAlreadySetInThisRequest = 'status' in allowedPatch;
            if (!statusAlreadySetInThisRequest && currentTask.status === 'Assigned') {
                markChange('status', currentTask.status, 'To do');
                allowedPatch.status = 'To do';
            }
        }




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

        const hasChanges = Object.keys(changed).length > 0;

        const updateQuery: Record<string, unknown> = { $set: allowedPatch };

        if (Object.keys(unsetPatch).length > 0) {
            updateQuery.$unset = unsetPatch;
        }

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

        const finalBsNumber =
            typeof allowedPatch.bsNumber === 'string' ? allowedPatch.bsNumber : currentTask.bsNumber;
        const finalBsAddress =
            typeof allowedPatch.bsAddress === 'string' ? allowedPatch.bsAddress : currentTask.bsAddress;
        const finalBsLocation = (allowedPatch.bsLocation ??
            (currentTask.bsLocation as TaskBsLocationItem[] | undefined)) as
            | TaskBsLocationItem[]
            | undefined;
        const coordsSource =
            Array.isArray(finalBsLocation) && finalBsLocation.length > 0
                ? finalBsLocation[0]?.coordinates
                : undefined;
        const coordsPair = parseCoordinatesPair(coordsSource);
        const latForSync = typeof lat === 'number' ? lat : coordsPair.lat;
        const lonForSync = typeof lon === 'number' ? lon : coordsPair.lon;

        if (finalBsNumber) {
            try {
                await ensureIrkutskT2Station({
                    bsNumber: finalBsNumber,
                    bsAddress: finalBsAddress,
                    lat: latForSync,
                    lon: lonForSync,
                    regionCode,
                    operatorCode,
                });
            } catch (syncErr) {
                console.error('Failed to sync base station document:', syncErr);
            }
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

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

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Server error';
}

/** Приводим входной статус (разные варианты из UI) к enum из схемы */
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
function normalizeStatus(input?: string): string | undefined {
    if (!input) return undefined;
    const key = input.trim().toUpperCase();
    return STATUS_TITLE_MAP[key] ?? input;
}

/** Приводим приоритет к допустимому нижнему регистру */
function normalizePriority(p?: string): 'urgent' | 'high' | 'medium' | 'low' | undefined {
    if (!p) return undefined;
    const v = String(p).toLowerCase();
    if (v === 'urgent' || v === 'high' || v === 'medium' || v === 'low') return v;
    return undefined;
}

function parseMaybeNumber(v: unknown): number | undefined {
    if (v === '' || v === null || typeof v === 'undefined') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}

function parseMaybeISODate(v: unknown): Date | undefined {
    if (!v) return undefined;
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Безопасно приводим _id к ObjectId */
function toObjectId(id: unknown): Types.ObjectId {
    if (id instanceof Types.ObjectId) return id;
    return new Types.ObjectId(String(id));
}

/* ========= Типы и type-guard для getOrgAndProjectByRef ========= */

type OrgDocLean = { _id: unknown };
type ProjectDocLean = {
    _id: unknown;
    operatorCode?: string;
    regionCode?: string;
};

type GetOrgProjectOk = { orgDoc: OrgDocLean; projectDoc: ProjectDocLean };
type GetOrgProjectErr = { error: string };

function isGetOrgProjectOk(x: unknown): x is GetOrgProjectOk {
    if (typeof x !== 'object' || x === null) return false;
    const obj = x as Record<string, unknown>;
    return 'orgDoc' in obj && 'projectDoc' in obj;
}

function extractError(x: unknown): string | undefined {
    if (typeof x !== 'object' || x === null) return undefined;
    const maybe = x as Partial<GetOrgProjectErr>;
    return typeof maybe.error === 'string' ? maybe.error : undefined;
}

/** элемент bsLocation в задаче */
interface TaskBsLocationItem {
    name: string;
    coordinates: string;
    address?: string;
}

/**
 * Узкая обёртка для безопасного извлечения org/project.
 * Возвращаем ещё и сам projectDoc, чтобы взять operatorCode/regionCode.
 */
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

    const orgId = toObjectId(rawOrgId);
    const projectId = toObjectId(rawProjectId);

    return { ok: true, orgId, projectId, projectDoc: refUnknown.projectDoc };
}

/* ====================== Handlers ====================== */

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

        const query: Record<string, unknown> = { orgId, projectId };
        if (Types.ObjectId.isValid(id)) {
            query._id = new Types.ObjectId(String(id));
        } else {
            // удаляем по taskId (короткий код задачи)
            query.taskId = id;
        }

        const del = await TaskModel.deleteOne(query);

        if (del.deletedCount === 0) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
    }
}


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

        // ищем текущую задачу либо по _id, либо по taskId
        const taskQuery: Record<string, unknown> = { orgId, projectId };
        if (Types.ObjectId.isValid(id)) {
            taskQuery._id = new Types.ObjectId(String(id));
        } else {
            taskQuery.taskId = id;
        }

        const currentTask = await TaskModel.findOne(taskQuery);
        if (!currentTask) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        const allowedPatch: Record<string, unknown> = {};

        if (typeof body.taskName === 'string') {
            allowedPatch.taskName = body.taskName;
        }
        if (typeof body.bsNumber === 'string') {
            allowedPatch.bsNumber = body.bsNumber;
        }
        if (typeof body.bsAddress === 'string') {
            allowedPatch.bsAddress = body.bsAddress;
        }

        if (typeof body.taskDescription === 'string') {
            const trimmed = body.taskDescription.trim();
            allowedPatch.taskDescription = trimmed || undefined;
        }

        const status = normalizeStatus(body.status as string | undefined);
        if (status) {
            allowedPatch.status = status;
        }

        const pr = normalizePriority(body.priority as string | undefined);
        if (pr) {
            allowedPatch.priority = pr;
        }

        const due = parseMaybeISODate(body.dueDate);
        if (due) {
            allowedPatch.dueDate = due;
        }

        const lat = parseMaybeNumber(body.bsLatitude);
        if (typeof lat !== 'undefined') {
            allowedPatch.bsLatitude = lat;
        }
        const lon = parseMaybeNumber(body.bsLongitude);
        if (typeof lon !== 'undefined') {
            allowedPatch.bsLongitude = lon;
        }

        if (typeof body.executorId === 'string' && body.executorId.trim()) {
            allowedPatch.executorId = body.executorId.trim();
            if (typeof body.executorName === 'string') {
                allowedPatch.executorName = body.executorName;
            }
            if (typeof body.executorEmail === 'string') {
                allowedPatch.executorEmail = body.executorEmail;
            }
        } else if (body.executorId === null) {
            allowedPatch.executorId = undefined;
            allowedPatch.executorName = undefined;
            allowedPatch.executorEmail = undefined;
        }

        if (typeof body.totalCost !== 'undefined') {
            const tc = parseMaybeNumber(body.totalCost);
            if (typeof tc !== 'undefined') {
                allowedPatch.totalCost = tc;
            } else {
                allowedPatch.totalCost = undefined;
            }
        }

        // --- геолокация / БС ---
        const clientBsLocation: TaskBsLocationItem[] | null = Array.isArray(body.bsLocation)
            ? (body.bsLocation as TaskBsLocationItem[])
            : null;

        const newBsNumber =
            typeof body.bsNumber === 'string'
                ? (body.bsNumber as string)
                : currentTask.bsNumber;

        const bsNumberChanged = newBsNumber !== currentTask.bsNumber;

        const operatorCode: string | undefined = projectDoc.operatorCode;
        const regionCode: string | undefined = projectDoc.regionCode;

        if (bsNumberChanged) {
            const bsQuery: {
                name: string;
                operatorCode?: string;
                regionCode?: string;
            } = { name: newBsNumber };
            if (operatorCode) bsQuery.operatorCode = operatorCode;
            if (regionCode) bsQuery.regionCode = regionCode;

            const bs = (await BaseStation.findOne(bsQuery).lean()) as
                | (IBaseStation & { operatorCode?: string; regionCode?: string })
                | null;

            if (bs) {
                if (bs.coordinates) {
                    allowedPatch.bsLocation = [
                        {
                            name: newBsNumber,
                            coordinates: bs.coordinates,
                            address: bs.address ?? '',
                        },
                    ];
                } else if (typeof bs.lat === 'number' && typeof bs.lon === 'number') {
                    allowedPatch.bsLocation = [
                        {
                            name: newBsNumber,
                            coordinates: `${bs.lat} ${bs.lon}`,
                            address: bs.address ?? '',
                        },
                    ];
                } else if (clientBsLocation) {
                    allowedPatch.bsLocation = clientBsLocation;
                } else {
                    allowedPatch.bsLocation = [];
                }
            } else if (clientBsLocation) {
                allowedPatch.bsLocation = clientBsLocation;
            } else {
                allowedPatch.bsLocation = [];
            }
        } else if (clientBsLocation) {
            allowedPatch.bsLocation = clientBsLocation;
        }

        const updated = await TaskModel.findOneAndUpdate(
            taskQuery,
            { $set: allowedPatch },
            { new: true, lean: true }
        );

        if (!updated) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        return NextResponse.json({ ok: true, task: updated });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
    }
}


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

        const rawId = String(id);

        let taskDoc;
        if (Types.ObjectId.isValid(rawId)) {
            taskDoc = await TaskModel.findOne(
                { _id: new Types.ObjectId(rawId), orgId, projectId },
                {},
                { lean: true }
            );
        } else {
            taskDoc = await TaskModel.findOne(
                { taskId: rawId, orgId, projectId },
                {},
                { lean: true }
            );
        }

        if (!taskDoc) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        return NextResponse.json({ task: taskDoc });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
    }
}

// src/app/api/org/[org]/projects/[project]/tasks/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
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

/** Безопасно приводим _id к ObjectId, не полагаясь на типы Lean/FlattenMaps */
function toObjectId(id: unknown): Types.ObjectId {
    if (id instanceof Types.ObjectId) return id;
    return new Types.ObjectId(String(id));
}

/* ========= Типы и type-guard для getOrgAndProjectByRef ========= */

type OrgDocLean = { _id: unknown };
type ProjectDocLean = { _id: unknown };

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

/** Узкая обёртка для безопасного извлечения org/project из getOrgAndProjectByRef */
async function requireOrgProject(
    orgSlug: string,
    projectRef: string
): Promise<
    | { ok: true; orgId: Types.ObjectId; projectId: Types.ObjectId }
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

    return { ok: true, orgId, projectId };
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

        if (!Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
        }

        const ensured = await requireOrgProject(orgSlug, projectRef);
        if (!ensured.ok) {
            return NextResponse.json({ error: ensured.error }, { status: ensured.status });
        }
        const { orgId, projectId } = ensured;

        const del = await TaskModel.deleteOne({
            _id: new Types.ObjectId(String(id)),
            orgId,
            projectId,
        });

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

        if (!Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
        }

        const ensured = await requireOrgProject(orgSlug, projectRef);
        if (!ensured.ok) {
            return NextResponse.json({ error: ensured.error }, { status: ensured.status });
        }
        const { orgId, projectId } = ensured;

        const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

        const allowedPatch: Record<string, unknown> = {};

        if (typeof body.taskName === 'string') allowedPatch.taskName = body.taskName;
        if (typeof body.bsNumber === 'string') allowedPatch.bsNumber = body.bsNumber;
        if (typeof body.bsAddress === 'string') allowedPatch.bsAddress = body.bsAddress;

        if (typeof body.taskDescription === 'string') {
            const trimmed = body.taskDescription.trim();
            allowedPatch.taskDescription = trimmed || undefined;
        }

        const status = normalizeStatus(body.status as string | undefined);
        if (status) allowedPatch.status = status;

        const pr = normalizePriority(body.priority as string | undefined);
        if (pr) allowedPatch.priority = pr;

        const due = parseMaybeISODate(body.dueDate);
        if (due) allowedPatch.dueDate = due;

        const lat = parseMaybeNumber(body.bsLatitude);
        if (typeof lat !== 'undefined') allowedPatch.bsLatitude = lat;

        const lng = parseMaybeNumber(body.bsLongitude);
        if (typeof lng !== 'undefined') allowedPatch.bsLongitude = lng;

        if (typeof body.executorId === 'string') allowedPatch.executorId = body.executorId;
        if (typeof body.executorName === 'string') allowedPatch.executorName = body.executorName;
        if (typeof body.executorEmail === 'string') allowedPatch.executorEmail = body.executorEmail;

        if (typeof body.totalCost !== 'undefined') {
            const tc = parseMaybeNumber(body.totalCost);
            if (typeof tc !== 'undefined') allowedPatch.totalCost = tc;
        }

        const updated = await TaskModel.findOneAndUpdate(
            {
                _id: new Types.ObjectId(String(id)),
                orgId,
                projectId,
            },
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
        if (!Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: 'Invalid task id' }, { status: 400 });
        }

        const ensured = await requireOrgProject(orgSlug, projectRef);
        if (!ensured.ok) {
            return NextResponse.json({ error: ensured.error }, { status: ensured.status });
        }
        const { orgId, projectId } = ensured;

        const task = await TaskModel.findOne(
            {
                _id: new Types.ObjectId(String(id)),
                orgId,
                projectId,
            },
            {},
            { lean: true }
        );

        if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        return NextResponse.json({ task });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
    }
}

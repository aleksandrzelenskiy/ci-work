// src/app/api/org/[org]/applications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import ApplicationModel from '@/app/models/ApplicationModel';
import TaskModel from '@/app/models/TaskModel';
import { requireOrgRole } from '@/app/utils/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ApplicationDTO = {
    _id: string;
    taskId: string;
    taskName: string;
    publicStatus?: string;
    visibility?: string;
    proposedBudget: number;
    contractorName?: string;
    contractorEmail?: string;
    status: string;
    createdAt?: string;
};

type GetApplicationsResponse = { applications: ApplicationDTO[] } | { error: string };

export async function GET(
    _request: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<GetApplicationsResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager', 'viewer']);

        const apps = await ApplicationModel.aggregate([
            { $match: { orgId: org._id } },
            { $sort: { createdAt: -1 } },
            { $limit: 50 },
            {
                $lookup: {
                    from: TaskModel.collection.name,
                    localField: 'taskId',
                    foreignField: '_id',
                    as: 'task',
                },
            },
            {
                $addFields: {
                    task: { $arrayElemAt: ['$task', 0] },
                },
            },
            {
                $project: {
                    taskId: '$task._id',
                    taskName: '$task.taskName',
                    publicStatus: '$task.publicStatus',
                    visibility: '$task.visibility',
                    proposedBudget: 1,
                    contractorName: 1,
                    contractorEmail: 1,
                    status: 1,
                    createdAt: 1,
                },
            },
        ]);

        const applications: ApplicationDTO[] = apps.map((a) => ({
            _id: String(a._id),
            taskId: String(a.taskId),
            taskName: a.taskName ?? 'Задача',
            publicStatus: a.publicStatus,
            visibility: a.visibility,
            proposedBudget: a.proposedBudget,
            contractorName: a.contractorName,
            contractorEmail: a.contractorEmail,
            status: a.status,
            createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : undefined,
        }));

        return NextResponse.json({ applications });
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Server error';
        const status = msg === 'Недостаточно прав' ? 403 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}

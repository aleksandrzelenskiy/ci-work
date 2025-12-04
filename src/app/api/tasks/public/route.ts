// app/api/tasks/public/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseNumber(value: string | null): number | undefined {
    if (!value) return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
}

function escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const skillsRaw = (searchParams.get('skills') || '').trim();
    const skills = skillsRaw ? skillsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const minBudget = parseNumber(searchParams.get('minBudget'));
    const maxBudget = parseNumber(searchParams.get('maxBudget'));
    const status = (searchParams.get('status') || '').trim();
    const regionCode = (searchParams.get('region') || '').trim();
    const limit = Math.min(parseNumber(searchParams.get('limit')) ?? 50, 100);

    try {
        await dbConnect();
    } catch (error) {
        console.error('DB connection error', error);
        return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });
    }

    const matchStage: Record<string, unknown> = {
        visibility: 'public',
    };

    if (status) {
        matchStage.publicStatus = status;
    } else {
        matchStage.publicStatus = { $in: ['open', 'in_review'] };
    }

    if (minBudget !== undefined || maxBudget !== undefined) {
        matchStage.budget = {};
        if (minBudget !== undefined) {
            (matchStage.budget as Record<string, number>).$gte = minBudget;
        }
        if (maxBudget !== undefined) {
            (matchStage.budget as Record<string, number>).$lte = maxBudget;
        }
    }

    if (skills.length > 0) {
        matchStage.skills = { $all: skills };
    }

    if (q) {
        const regex = new RegExp(escapeRegExp(q), 'i');
        matchStage.$or = [
            { taskName: regex },
            { taskDescription: regex },
            { bsNumber: regex },
        ];
    }

    const pipeline: mongoose.PipelineStage[] = [
        { $match: matchStage },
        {
            $lookup: {
                from: 'projects',
                localField: 'projectId',
                foreignField: '_id',
                as: 'projectDoc',
            },
        },
        {
            $addFields: {
                project: { $arrayElemAt: ['$projectDoc', 0] },
            },
        },
    ];

    if (regionCode) {
        pipeline.push({ $match: { 'project.regionCode': regionCode } });
    }

    pipeline.push(
        {
            $project: {
                projectDoc: 0,
            },
        },
        { $sort: { createdAt: -1 } },
        { $limit: limit }
    );

    try {
        const tasks = await TaskModel.aggregate(pipeline);
        return NextResponse.json({ tasks });
    } catch (error) {
        console.error('Failed to load public tasks', error);
        return NextResponse.json({ error: 'Failed to load tasks' }, { status: 500 });
    }
}

// app/api/reports/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import Report from '@/app/models/ReportModel';
import UserModel from '@/app/models/UserModel';
import { currentUser } from '@clerk/nextjs/server';
import type { PipelineStage } from 'mongoose';

export async function GET() {
  try {
    await dbConnect();
    console.log('Connected to MongoDB');
  } catch (error: unknown) {
    console.error('Failed to connect to MongoDB:', error);
    return NextResponse.json(
      { error: 'Failed to connect to database' },
      { status: 500 }
    );
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json(
      { error: 'No active user session found' },
      { status: 401 }
    );
  }

  const existingUser = await UserModel.findOne({ clerkUserId: clerkUser.id });
  if (!existingUser) {
    return NextResponse.json(
      { error: 'User not found in MongoDB' },
      { status: 404 }
    );
  }

  const userRole = existingUser.role;

  const pipeline: PipelineStage[] = [];

  if (userRole === 'executor') {
    pipeline.push({ $match: { executorId: clerkUser.id } });
  }
  if (userRole === 'initiator') {
    pipeline.push({ $match: { initiatorId: clerkUser.id } });
  }

  pipeline.push(
    { $unwind: '$events' },
    {
      $group: {
        _id: '$_id',
        reportId: { $first: '$reportId' },
        status: { $last: '$status' },
        latestStatusChangeDate: { $max: '$events.date' },
        executorId: { $first: '$executorId' },
        executorName: { $first: '$executorName' },
        executorAvatar: { $first: '$executorAvatar' },
        initiatorId: { $first: '$initiatorId' },
        initiatorName: { $first: '$initiatorName' },
        createdAt: { $first: '$createdAt' },
        task: { $first: '$task' },
        baseId: { $first: '$baseId' },
      },
    },
    {
      $group: {
        _id: '$reportId',
        reportId: { $first: '$reportId' },
        task: { $first: '$task' },
        executorId: { $first: '$executorId' },
        executorName: { $first: '$executorName' },
        executorAvatar: { $first: '$executorAvatar' },
        initiatorId: { $first: '$initiatorId' },
        initiatorName: { $first: '$initiatorName' },
        createdAt: { $first: '$createdAt' },
        baseStatuses: {
          $push: {
            baseId: '$baseId',
            status: '$status',
            latestStatusChangeDate: '$latestStatusChangeDate',
          },
        },
      },
    },
    { $sort: { createdAt: -1 } }
  );

  let rawReports;
  try {
    rawReports = await Report.aggregate(pipeline);
  } catch (error: unknown) {
    console.error('Error during aggregation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }

  const reports = rawReports.map((report) => ({
    _id: report._id,
    reportId: report.reportId,
    task: report.task,
    executorId: report.executorId,
    executorName: report.executorName,
    executorAvatar: report.executorAvatar || '',
    initiatorId: report.initiatorId || 'Unknown',
    initiatorName: report.initiatorName || 'Unknown',
    createdAt: report.createdAt,
    baseStatuses: report.baseStatuses.map(
      (bs: {
        baseId: unknown;
        status: unknown;
        latestStatusChangeDate: unknown;
      }) => ({
        baseId: bs.baseId,
        status: bs.status,
        latestStatusChangeDate: bs.latestStatusChangeDate,
      })
    ),
  }));

  return NextResponse.json({ reports, userRole });
}

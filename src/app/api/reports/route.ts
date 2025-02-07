// app/api/reports/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import Report from '@/app/models/ReportModel';
import UserModel from '@/app/models/UserModel';
import { currentUser } from '@clerk/nextjs/server';
import type { PipelineStage } from 'mongoose';

export async function GET() {
  // 1. Подключаемся к базе
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

  // 2. Получаем текущего user из Clerk
  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json(
      { error: 'No active user session found' },
      { status: 401 }
    );
  }

  // 3. Находим в MongoDB запись пользователя, чтобы узнать его роль
  const existingUser = await UserModel.findOne({ clerkUserId: clerkUser.id });
  if (!existingUser) {
    return NextResponse.json(
      { error: 'User not found in MongoDB' },
      { status: 404 }
    );
  }

  const userRole = existingUser.role; // "executor", "initiator", "admin" и т.д.

  // 4. Формируем pipeline для агрегации
  const pipeline: PipelineStage[] = [];

  // Если executor — смотреть только свои отчёты, если initiator — те, в которых он initiator
  if (userRole === 'executor') {
    pipeline.push({ $match: { executorId: clerkUser.id } });
  }
  if (userRole === 'initiator') {
    pipeline.push({ $match: { initiatorId: clerkUser.id } });
  }

  // Существующий pipeline:
  pipeline.push(
    { $unwind: '$events' },
    {
      $group: {
        _id: { task: '$task', baseId: '$baseId' },
        status: { $last: '$status' },
        latestStatusChangeDate: { $max: '$events.date' },
        userId: { $first: '$userId' },
        userName: { $first: '$userName' },
        userAvatar: { $first: '$userAvatar' },

        // ДОБАВИЛИ reviewerName, чтобы вернуть его в итоговый объект
        reviewerName: { $first: '$reviewerName' },

        createdAt: { $first: '$createdAt' },
      },
    },
    {
      $group: {
        _id: '$_id.task',
        task: { $first: '$_id.task' },
        userId: { $first: '$userId' },
        userName: { $first: '$userName' },
        userAvatar: { $first: '$userAvatar' },

        // Также поднимаем reviewerName на уровень задачи
        reviewerName: { $first: '$reviewerName' },

        createdAt: { $first: '$createdAt' },
        baseStatuses: {
          $push: {
            baseId: '$_id.baseId',
            status: '$status',
            latestStatusChangeDate: '$latestStatusChangeDate',
          },
        },
      },
    },
    { $sort: { createdAt: -1 } }
  );

  // 5. Выполняем агрегацию
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

  console.log('Aggregated Reports:', rawReports);

  // 6. Маппинг результата
  const reports = rawReports.map((report) => ({
    _id: report._id,
    task: report.task,
    userId: report.userId,
    userName: report.userName,
    userAvatar: report.userAvatar || '',
    reviewerName: report.reviewerName || 'Unknown',
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

  // В ответе, помимо reports, возвращаем userRole,
  // чтобы клиентский компонент знал, какую роль отображать
  return NextResponse.json({ reports, userRole });
}

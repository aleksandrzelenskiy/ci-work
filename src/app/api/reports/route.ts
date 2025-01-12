// /app/api/reports/route.ts
import { NextResponse } from 'next/server';
import Report from '@/app/models/Report';
import dbConnect from '@/utils/mongoose';

export async function GET() {
  // Устанавливаем подключение к базе данных
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

  try {
    const rawReports = await Report.aggregate([
      // Разворачиваем массив событий для обработки каждого события отдельно
      { $unwind: '$events' },

      // Группируем по task и baseId, чтобы получить последнюю дату изменения статуса для каждого baseId
      {
        $group: {
          _id: { task: '$task', baseId: '$baseId' },
          status: { $last: '$status' }, // Предполагается, что статус обновляется последним событием
          latestStatusChangeDate: { $max: '$events.date' },
          userId: { $first: '$userId' }, // Получаем userId
          userName: { $first: '$userName' },
          userAvatar: { $first: '$userAvatar' },
          createdAt: { $first: '$createdAt' },
        },
      },

      // Группируем по task, собирая все baseStatuses с датой изменения статуса
      {
        $group: {
          _id: '$_id.task',
          task: { $first: '$_id.task' },
          userId: { $first: '$userId' },
          userName: { $first: '$userName' },
          userAvatar: { $first: '$userAvatar' },
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

      // Сортируем отчёты по дате создания в порядке убывания
      { $sort: { createdAt: -1 } },
    ]);

    console.log('Aggregated Reports:', rawReports); // Лог для проверки структуры данных

    // Формируем отчеты, используя сохраненный userAvatar
    const reports = rawReports.map((report) => ({
      _id: report._id,
      task: report.task,
      userId: report.userId,
      userName: report.userName,
      userAvatar: report.userAvatar || '', // Используем userAvatar из Report
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

    return NextResponse.json({ reports });
  } catch (error: unknown) {
    console.error('Error during aggregation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

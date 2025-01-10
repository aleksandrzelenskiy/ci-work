import { NextResponse } from 'next/server';
import Report from '@/app/models/Report';

export async function GET() {
  try {
    const reports = await Report.aggregate([
      {
        $group: {
          _id: '$task',
          task: { $first: '$task' },
          userName: { $first: '$userName' },
          userAvatar: { $first: '$userAvatar' },
          createdAt: { $min: '$createdAt' },
          baseStatuses: {
            $push: { baseId: '$baseId', status: '$status' },
          },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    console.log('Aggregated Reports:', reports); // Лог для проверки структуры данных

    // Гарантируем, что возвращается массив
    return NextResponse.json(Array.isArray(reports) ? reports : []);
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

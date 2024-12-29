import { NextResponse } from 'next/server';
import clientPromise from '@/utils/mongodb';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('photo_reports');
    const collection = db.collection('reports');

    const reports = await collection
      .aggregate([
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
      ])
      .toArray();

    return NextResponse.json(
      reports.map((report) => ({
        ...report,
        baseStatuses: report.baseStatuses || [], // Гарантируем массив
      }))
    );
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

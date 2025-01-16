// app/api/reports/route.ts
import { NextResponse } from 'next/server';
import Report from '@/app/models/Report';
import dbConnect from '@/utils/mongoose';

export async function GET() {
  // Establish connection to the database
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
      // Unwind the events array to process each event separately
      { $unwind: '$events' },

      // Group by task and baseId to get the latest status change date for each baseId
      {
        $group: {
          _id: { task: '$task', baseId: '$baseId' },
          status: { $last: '$status' },
          latestStatusChangeDate: { $max: '$events.date' },
          userId: { $first: '$userId' },
          userName: { $first: '$userName' },
          userAvatar: { $first: '$userAvatar' },
          createdAt: { $first: '$createdAt' },
        },
      },

      // Group by task, collecting all baseStatuses with their status change dates
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

      // Sort reports by creation date in descending order
      { $sort: { createdAt: -1 } },
    ]);

    console.log('Aggregated Reports:', rawReports);

    // Format reports, using the stored userAvatar
    const reports = rawReports.map((report) => ({
      _id: report._id,
      task: report.task,
      userId: report.userId,
      userName: report.userName,
      userAvatar: report.userAvatar || '',
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

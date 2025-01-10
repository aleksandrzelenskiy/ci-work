import { NextResponse } from 'next/server';
import Report from '@/app/models/Report';
import dbConnect from '@/utils/mongoose';

export async function GET(
  request: Request,
  context: { params: { task: string; baseid: string } }
) {
  try {
    console.log('Connecting to database...');
    await dbConnect();
    console.log('Database connection successful.');

    // Получаем параметры асинхронно
    const { task, baseid } = await Promise.resolve(context.params);

    console.log(`Task: ${task}, BaseID: ${baseid}`);

    const decodedTask = decodeURIComponent(task);
    const decodedBaseId = decodeURIComponent(baseid);

    console.log(
      `Decoded Task: ${decodedTask}, Decoded BaseID: ${decodedBaseId}`
    );

    const report = await Report.findOne({
      task: decodedTask,
      baseId: decodedBaseId,
    });

    if (!report) {
      console.warn('Report not found.');
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    console.log('Report found:', report);

    return NextResponse.json({
      files: report.files,
      createdAt: report.createdAt,
      userName: report.userName,
      status: report.status,
      issues: report.issues || [],
      fixedFiles: report.fixedFiles || [],
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: { task: string; baseid: string } }
) {
  try {
    console.log('Connecting to database...');
    await dbConnect();
    console.log('Database connection successful.');

    // Получаем параметры асинхронно
    const { task, baseid } = await Promise.resolve(context.params);

    console.log(`Task: ${task}, BaseID: ${baseid}`);

    const decodedTask = decodeURIComponent(task);
    const decodedBaseId = decodeURIComponent(baseid);

    console.log(
      `Decoded Task: ${decodedTask}, Decoded BaseID: ${decodedBaseId}`
    );

    const body: {
      status?: string;
      issues?: string[];
      updateIssue?: { index: number; text: string };
      deleteIssueIndex?: number;
    } = await request.json();

    console.log('Request Body:', body);

    const { status, issues, updateIssue, deleteIssueIndex } = body;

    const report = await Report.findOne({
      task: decodedTask,
      baseId: decodedBaseId,
    });

    if (!report) {
      console.warn('Report not found.');
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    console.log('Report found for update:', report);

    if (status) {
      console.log(`Updating status to: ${status}`);
      report.status = status;
    }

    if (Array.isArray(issues)) {
      console.log(`Updating issues to: ${issues}`);
      report.issues = Array.from(new Set(issues));
    }

    if (updateIssue) {
      const { index, text } = updateIssue;
      console.log(`Updating issue at index ${index} with text: ${text}`);
      if (
        index >= 0 &&
        Array.isArray(report.issues) &&
        index < report.issues.length
      ) {
        report.issues[index] = text;
      } else {
        console.warn('Invalid index for issue update.');
        return NextResponse.json(
          { error: 'Invalid index for issue update' },
          { status: 400 }
        );
      }
    }

    if (typeof deleteIssueIndex === 'number') {
      console.log(`Deleting issue at index: ${deleteIssueIndex}`);
      if (
        deleteIssueIndex >= 0 &&
        Array.isArray(report.issues) &&
        deleteIssueIndex < report.issues.length
      ) {
        report.issues.splice(deleteIssueIndex, 1);
      } else {
        console.warn('Invalid index for issue delete.');
        return NextResponse.json(
          { error: 'Invalid index for issue delete' },
          { status: 400 }
        );
      }
    }

    await report.save();
    console.log('Report updated successfully.');

    return NextResponse.json({ message: 'Report updated successfully' });
  } catch (error) {
    console.error('Error updating report:', error);
    return NextResponse.json(
      { error: 'Failed to update report' },
      { status: 500 }
    );
  }
}

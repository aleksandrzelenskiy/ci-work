// app/api/reports/[task]/[baseid]/route.ts
import { NextResponse } from 'next/server';
import Report from '@/app/models/Report';
import dbConnect from '@/utils/mongoose';
import { currentUser } from '@clerk/nextjs/server';

/**
 * GET обработчик для получения информации о конкретном отчёте.
 */
export async function GET(
  request: Request,
  context: { params: { task: string; baseid: string } }
) {
  try {
    console.log('Connecting to the database...');
    await dbConnect();
    console.log('Successfully connected to the database.');

    const params = await context.params;
    const { task, baseid } = params;

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
      console.warn('The report was not found.');
      return NextResponse.json(
        { error: 'The report was not found' },
        { status: 404 }
      );
    }

    console.log('Report found:', report);

    return NextResponse.json({
      files: report.files,
      createdAt: report.createdAt,
      userName: report.userName,
      status: report.status,
      issues: report.issues || [],
      fixedFiles: report.fixedFiles || [],
      events: report.events || [],
    });
  } catch (error) {
    console.error('Error when receiving the report:', error);
    return NextResponse.json(
      { error: 'Could not get the report' },
      { status: 500 }
    );
  }
}

/**
 * PATCH обработчик для обновления информации о конкретном отчёте.
 */
export async function PATCH(
  request: Request,
  context: { params: { task: string; baseid: string } }
) {
  try {
    console.log('Connecting to the database...');
    await dbConnect();
    console.log('Successfully connected to the database.');

    const params = await context.params;
    const { task, baseid } = params;

    console.log(`Task: ${task}, BaseID: ${baseid}`);

    const decodedTask = decodeURIComponent(task);
    const decodedBaseId = decodeURIComponent(baseid);

    console.log(
      `Decoded Task: ${decodedTask}, Decoded BaseID: ${decodedBaseId}`
    );

    // Get the current user
    const user = await currentUser();
    if (!user) {
      console.error('Authentication error: User is not authenticated');
      return NextResponse.json(
        { error: 'User is not authenticated' },
        { status: 401 }
      );
    }

    const name = `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim();
    console.log(`Authenticated user: ${name}`);

    // Extract the request body
    const body: {
      status?: string;
      issues?: string[];
      updateIssue?: { index: number; text: string };
      deleteIssueIndex?: number;
    } = await request.json();

    console.log('Request body:', body);

    const { status, issues, updateIssue, deleteIssueIndex } = body;

    // Find the report in the database
    const report = await Report.findOne({
      task: decodedTask,
      baseId: decodedBaseId,
    });

    if (!report) {
      console.warn('Report not found.');
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    console.log('Report found for updating:', report);

    // Save old values for comparison
    const oldStatus = report.status;
    const oldIssues = [...report.issues];

    // --- Update status ---
    if (status && status !== oldStatus) {
      console.log(`Updating status to: ${status}`);
      report.status = status;

      // Add an event to the change history
      if (!report.events) report.events = [];
      report.events.push({
        action: 'STATUS_CHANGED',
        author: name,
        authorId: user.id,
        date: new Date(),
        details: {
          oldStatus,
          newStatus: status,
        },
      });
    }

    // --- Update issues array ---
    let issuesChanged = false;

    if (Array.isArray(issues)) {
      // Compare old and new issues to determine changes
      const oldIssuesSet = new Set(oldIssues);
      const newIssuesSet = new Set(issues);

      const addedIssues = issues.filter((issue) => !oldIssuesSet.has(issue));
      const removedIssues = oldIssues.filter(
        (issue) => !newIssuesSet.has(issue)
      );

      if (addedIssues.length > 0 || removedIssues.length > 0) {
        issuesChanged = true;
        report.issues = Array.from(newIssuesSet);
      }
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
        issuesChanged = true;
      } else {
        console.warn('Invalid index for updating issue.');
        return NextResponse.json(
          { error: 'Invalid index for updating issue' },
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
        issuesChanged = true;
      } else {
        console.warn('Invalid index for deleting issue.');
        return NextResponse.json(
          { error: 'Invalid index for deleting issue' },
          { status: 400 }
        );
      }
    }

    // If the issues array has changed, add an event
    if (issuesChanged) {
      if (!report.events) report.events = [];
      report.events.push({
        action: 'ISSUES_UPDATED',
        author: name,
        authorId: user.id,
        date: new Date(),
        details: {
          oldIssues,
          newIssues: report.issues,
        },
      });
    }

    // Save changes to the database
    await report.save();
    console.log('Report successfully updated.');

    return NextResponse.json({ message: 'Report successfully updated' });
  } catch (error) {
    console.error('Error updating the report:', error);
    return NextResponse.json(
      { error: 'Could not update the report' },
      { status: 500 }
    );
  }
}

// app/api/reports/[task]/[baseid]/route.ts
import { NextResponse } from 'next/server';
import Report from '@/app/models/Report';
import dbConnect from '@/utils/mongoose';
import { currentUser } from '@clerk/nextjs/server';

/**
 * GET handler для получения информации о конкретном отчёте.
 */
export async function GET(
  request: Request,
  context: { params: { task: string; baseid: string } }
) {
  try {
    console.log('Connecting to database...');
    await dbConnect();
    console.log('Database connection successful.');

    // Await параметры маршрута
    const { task, baseid } = await context.params;

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
      events: report.events || [],
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}

/**
 * PATCH handler для обновления информации о конкретном отчёте.
 */
export async function PATCH(
  request: Request,
  context: { params: { task: string; baseid: string } }
) {
  try {
    console.log('Connecting to database...');
    await dbConnect();
    console.log('Database connection successful.');

    // Await параметры маршрута
    const { task, baseid } = await context.params;

    console.log(`Task: ${task}, BaseID: ${baseid}`);

    const decodedTask = decodeURIComponent(task);
    const decodedBaseId = decodeURIComponent(baseid);

    console.log(
      `Decoded Task: ${decodedTask}, Decoded BaseID: ${decodedBaseId}`
    );

    // Получаем текущего пользователя
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

    // Извлекаем тело запроса
    const body: {
      status?: string;
      issues?: string[];
      updateIssue?: { index: number; text: string };
      deleteIssueIndex?: number;
    } = await request.json();

    console.log('Request Body:', body);

    const { status, issues, updateIssue, deleteIssueIndex } = body;

    // Находим отчёт в базе данных
    const report = await Report.findOne({
      task: decodedTask,
      baseId: decodedBaseId,
    });

    if (!report) {
      console.warn('Report not found.');
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    console.log('Report found for update:', report);

    // Сохраняем старые значения для сравнения
    const oldStatus = report.status;
    const oldIssues = [...report.issues];

    // --- Изменение статуса ---
    if (status && status !== oldStatus) {
      console.log(`Updating status to: ${status}`);
      report.status = status;

      // Добавляем событие в историю изменений
      if (!report.events) report.events = [];
      report.events.push({
        action: 'STATUS_CHANGED',
        author: name,
        date: new Date(),
        details: {
          oldStatus,
          newStatus: status,
        },
      });
    }

    // --- Изменение массива issues ---
    let issuesChanged = false;

    if (Array.isArray(issues)) {
      // Сравнение старых и новых issues для определения изменений
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
        issuesChanged = true;
      } else {
        console.warn('Invalid index for issue delete.');
        return NextResponse.json(
          { error: 'Invalid index for issue delete' },
          { status: 400 }
        );
      }
    }

    // Если массив issues изменился, добавляем событие
    if (issuesChanged) {
      if (!report.events) report.events = [];
      report.events.push({
        action: 'ISSUES_UPDATED',
        author: name,
        date: new Date(),
        details: {
          oldIssues,
          newIssues: report.issues,
        },
      });
    }

    // Сохраняем изменения в базе данных
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

// app/api/reports/[task]/[baseid]/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import ReportModel from '@/app/models/ReportModel';
import UserModel from '@/app/models/UserModel';
import TaskModel from '@/app/models/TaskModel';
import { currentUser } from '@clerk/nextjs/server';

/**
 * GET обработчик для получения информации о конкретном отчёте.
 * Дополнительно возвращаем `role` текущего пользователя.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ task: string; baseid: string }> }
) {
  try {
    await dbConnect();

    const { task, baseid } = await params;
    const taskDecoded = decodeURIComponent(task);
    const baseidDecoded = decodeURIComponent(baseid);

    if (!taskDecoded || !baseidDecoded) {
      return NextResponse.json(
          { error: 'Missing parameters in URL' },
          { status: 400 }
      );
    }

    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json(
          { error: 'Нет активной сессии пользователя' },
          { status: 401 }
      );
    }

    const dbUser = await UserModel.findOne({ clerkUserId: clerkUser.id });
    if (!dbUser) {
      return NextResponse.json(
          { error: 'Пользователь не найден в базе данных' },
          { status: 404 }
      );
    }

    const report = await ReportModel.findOne({
      task: taskDecoded,
      baseId: baseidDecoded,
    });

    if (!report) {
      return NextResponse.json({ error: 'Отчёт не найден' }, { status: 404 });
    }

    return NextResponse.json({
      reportId: report.reportId,
      files: report.files,
      createdAt: report.createdAt,
      executorName: report.executorName,
      reviewerName: report.reviewerName,
      status: report.status,
      issues: report.issues || [],
      fixedFiles: report.fixedFiles || [],
      events: report.events || [],
      role: dbUser.role,
    });
  } catch (error) {
    console.error('Ошибка при получении отчёта:', error);
    return NextResponse.json(
        { error: 'Не удалось получить отчёт' },
        { status: 500 }
    );
  }
}

/**
 * PATCH обработчик для обновления информации о конкретном отчёте.
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ task: string; baseid: string }> }
) {
  try {
    await dbConnect();

    const { task, baseid } = await params;
    const taskDecoded = decodeURIComponent(task);
    const baseidDecoded = decodeURIComponent(baseid);

    if (!taskDecoded || !baseidDecoded) {
      return NextResponse.json(
          { error: 'Missing parameters in URL' },
          { status: 400 }
      );
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
          { error: 'Пользователь не авторизован' },
          { status: 401 }
      );
    }

    const name = `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim();

    const body: {
      status?: string;
      issues?: string[];
      updateIssue?: { index: number; text: string };
      deleteIssueIndex?: number;
    } = await request.json();

    const { status, issues, updateIssue, deleteIssueIndex } = body;

    // Находим отчёт
    const report = await ReportModel.findOne({
      task: taskDecoded,
      baseId: baseidDecoded,
    });

    if (!report) {
      return NextResponse.json({ error: 'Отчёт не найден' }, { status: 404 });
    }

    const oldStatus = report.status;
    const oldIssues = [...report.issues];

    // Обновляем статус
    if (status && status !== oldStatus) {
      report.status = status;
      report.events = report.events || [];
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

    // Обновление массива issues
    let issuesChanged = false;
    if (Array.isArray(issues)) {
      const oldIssuesSet = new Set(oldIssues);
      const newIssuesSet = new Set(issues);

      const addedIssues = issues.filter((i) => !oldIssuesSet.has(i));
      const removedIssues = oldIssues.filter((i) => !newIssuesSet.has(i));

      if (addedIssues.length > 0 || removedIssues.length > 0) {
        issuesChanged = true;
        report.issues = Array.from(newIssuesSet);
      }
    }

    if (updateIssue) {
      const { index, text } = updateIssue;
      if (
          index >= 0 &&
          Array.isArray(report.issues) &&
          index < report.issues.length
      ) {
        report.issues[index] = text;
        issuesChanged = true;
      } else {
        return NextResponse.json(
            { error: 'Неверный индекс для обновления issue' },
            { status: 400 }
        );
      }
    }

    if (typeof deleteIssueIndex === 'number') {
      if (
          deleteIssueIndex >= 0 &&
          Array.isArray(report.issues) &&
          deleteIssueIndex < report.issues.length
      ) {
        report.issues.splice(deleteIssueIndex, 1);
        issuesChanged = true;
      } else {
        return NextResponse.json(
            { error: 'Неверный индекс для удаления issue' },
            { status: 400 }
        );
      }
    }

    // Если список issues был изменён, добавляем событие
    if (issuesChanged) {
      report.events = report.events || [];
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

    // Сохраняем сам отчёт
    await report.save();

    // Синхронизируем статус с задачей
    const relatedTask = await TaskModel.findOne({ taskId: report.reportId });
    if (relatedTask && relatedTask.status !== report.status) {
      const oldTaskStatus = relatedTask.status;
      relatedTask.status = report.status;

      relatedTask.events = relatedTask.events || [];
      relatedTask.events.push({
        action: 'STATUS_CHANGED',
        author: name,
        authorId: user.id,
        date: new Date(),
        details: {
          oldStatus: oldTaskStatus,
          newStatus: report.status,
          comment: 'Статус синхронизирован с фотоотчетом',
        },
      });

      await relatedTask.save();
    }

    return NextResponse.json({ message: 'Отчёт успешно обновлён' });
  } catch (error) {
    console.error('Ошибка при обновлении отчёта:', error);
    return NextResponse.json(
        { error: 'Не удалось обновить отчёт' },
        { status: 500 }
    );
  }
}

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
  context: { params: { task: string; baseid: string } }
) {
  try {
    // Извлекаем и "дожидаемся" параметры [task] и [baseid]
    const rawTask = await context.params.task;
    const rawBaseId = await context.params.baseid;
    // Декодируем
    const taskDecoded = decodeURIComponent(rawTask);
    const baseidDecoded = decodeURIComponent(rawBaseId);

    if (!taskDecoded || !baseidDecoded) {
      return NextResponse.json(
        { error: 'Missing parameters in URL' },
        { status: 400 }
      );
    }

    console.log('Подключаемся к базе данных...');
    await dbConnect();
    console.log('Успешное подключение к базе данных.');

    const clerkUser = await currentUser();
    if (!clerkUser) {
      console.error('Нет активной сессии пользователя');
      return NextResponse.json(
        { error: 'Нет активной сессии пользователя' },
        { status: 401 }
      );
    }

    // Ищем соответствующего пользователя в MongoDB, чтобы узнать его роль
    const dbUser = await UserModel.findOne({ clerkUserId: clerkUser.id });
    if (!dbUser) {
      console.warn('Пользователь не найден в базе данных MongoDB');
      return NextResponse.json(
        { error: 'Пользователь не найден в базе данных' },
        { status: 404 }
      );
    }

    // Находим отчёт по task и baseId
    const report = await ReportModel.findOne({
      task: taskDecoded,
      baseId: baseidDecoded,
    });

    if (!report) {
      console.warn('Отчёт не найден');
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
  context: { params: { task: string; baseid: string } }
) {
  try {
    // Аналогично, получаем сырые параметры и дожидаемся их
    const rawTask = await context.params.task;
    const rawBaseId = await context.params.baseid;
    const taskDecoded = decodeURIComponent(rawTask);
    const baseidDecoded = decodeURIComponent(rawBaseId);

    if (!taskDecoded || !baseidDecoded) {
      return NextResponse.json(
        { error: 'Missing parameters in URL' },
        { status: 400 }
      );
    }

    console.log('Подключаемся к базе данных...');
    await dbConnect();
    console.log('Успешное подключение к базе данных.');

    const user = await currentUser();
    if (!user) {
      console.error('Ошибка аутентификации: пользователь не авторизован');
      return NextResponse.json(
        { error: 'Пользователь не авторизован' },
        { status: 401 }
      );
    }

    const name = `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim();
    console.log(`Авторизованный пользователь: ${name}`);

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
      console.warn('Отчёт не найден.');
      return NextResponse.json({ error: 'Отчёт не найден' }, { status: 404 });
    }

    const oldStatus = report.status;
    const oldIssues = [...report.issues];

    // Обновляем статус
    if (status && status !== oldStatus) {
      report.status = status;
      if (!report.events) {
        report.events = [];
      }
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

      const addedIssues = issues.filter((iss) => !oldIssuesSet.has(iss));
      const removedIssues = oldIssues.filter((iss) => !newIssuesSet.has(iss));

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
      if (!report.events) {
        report.events = [];
      }
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

    // Сохраняем
    await report.save();

    // Синхронизируем статус с задачей (если она есть)
    const relatedTask = await TaskModel.findOne({ taskId: report.reportId });
    if (relatedTask && relatedTask.status !== report.status) {
      const oldTaskStatus = relatedTask.status;
      relatedTask.status = report.status;
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

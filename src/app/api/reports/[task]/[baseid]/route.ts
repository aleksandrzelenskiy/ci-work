// app/api/reports/[task]/[taskid]/route.ts

import { NextResponse } from 'next/server';
import ReportModel from '@/app/models/ReportModel';
import dbConnect from '@/utils/mongoose';
import { currentUser } from '@clerk/nextjs/server';
import UserModel from '@/app/models/UserModel';

/**
 * GET обработчик для получения информации о конкретном отчёте.
 * Дополнительно возвращаем `role` текущего пользователя.
 */
export async function GET(
  request: Request,
  { params }: { params: { task: string; baseid: string } }
) {
  try {
    console.log('Подключаемся к базе данных...');
    await dbConnect();
    console.log('Успешное подключение к базе данных.');

    const { task, baseid } = await params;
    const decodedTask = decodeURIComponent(task);
    const decodedBaseId = decodeURIComponent(baseid);

    // console.log(
    //   `Значения после decodeURIComponent -> Task: ${decodedTask}, BaseID: ${decodedBaseId}`
    // );

    // Получаем текущего пользователя из Clerk
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
      task: decodedTask,
      baseId: decodedBaseId,
    });

    if (!report) {
      console.warn('Отчёт не найден');
      return NextResponse.json({ error: 'Отчёт не найден' }, { status: 404 });
    }

    // console.log('Отчёт найден:', report);

    // Возвращаем необходимые данные, включая роль пользователя
    return NextResponse.json({
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
  { params }: { params: { task: string; baseid: string } }
) {
  try {
    console.log('Подключаемся к базе данных...');
    await dbConnect();
    console.log('Успешное подключение к базе данных.');

    const { task, baseid } = params;
    const decodedTask = decodeURIComponent(task);
    const decodedBaseId = decodeURIComponent(baseid);

    // Получаем текущего пользователя
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

    // Парсим тело запроса
    const body: {
      status?: string;
      issues?: string[];
      updateIssue?: { index: number; text: string };
      deleteIssueIndex?: number;
    } = await request.json();

    // console.log('Тело запроса:', body);

    const { status, issues, updateIssue, deleteIssueIndex } = body;

    // Находим отчёт в базе данных
    const report = await ReportModel.findOne({
      task: decodedTask,
      baseId: decodedBaseId,
    });

    if (!report) {
      console.warn('Отчёт не найден.');
      return NextResponse.json({ error: 'Отчёт не найден' }, { status: 404 });
    }

    console.log('Отчёт найден для обновления:', report);

    // Сохраняем старые значения для истории изменений
    const oldStatus = report.status;
    const oldIssues = [...report.issues];

    // -- Обновление статуса --
    if (status && status !== oldStatus) {
      console.log(`Обновляем статус на: ${status}`);
      report.status = status;

      // Добавляем событие в массив events (история изменений)
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

    // -- Обновление массива issues --
    let issuesChanged = false;

    if (Array.isArray(issues)) {
      const oldIssuesSet = new Set(oldIssues);
      const newIssuesSet = new Set(issues);

      // Определяем, какие issues были добавлены, а какие удалены
      const addedIssues = issues.filter((issue) => !oldIssuesSet.has(issue));
      const removedIssues = oldIssues.filter(
        (issue) => !newIssuesSet.has(issue)
      );

      if (addedIssues.length > 0 || removedIssues.length > 0) {
        issuesChanged = true;
        report.issues = Array.from(newIssuesSet);
      }
    }

    // Точечное обновление конкретного issue по индексу
    if (updateIssue) {
      const { index, text } = updateIssue;
      console.log(`Обновляем issue по индексу ${index} на текст: ${text}`);
      if (
        index >= 0 &&
        Array.isArray(report.issues) &&
        index < report.issues.length
      ) {
        report.issues[index] = text;
        issuesChanged = true;
      } else {
        console.warn('Неверный индекс для обновления issue.');
        return NextResponse.json(
          { error: 'Неверный индекс для обновления issue' },
          { status: 400 }
        );
      }
    }

    // Удаление конкретного issue по индексу
    if (typeof deleteIssueIndex === 'number') {
      console.log(`Удаляем issue по индексу: ${deleteIssueIndex}`);
      if (
        deleteIssueIndex >= 0 &&
        Array.isArray(report.issues) &&
        deleteIssueIndex < report.issues.length
      ) {
        report.issues.splice(deleteIssueIndex, 1);
        issuesChanged = true;
      } else {
        console.warn('Неверный индекс для удаления issue.');
        return NextResponse.json(
          { error: 'Неверный индекс для удаления issue' },
          { status: 400 }
        );
      }
    }

    // Если список issues был изменён, добавляем событие в историю
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

    // Сохраняем изменения в базе
    await report.save();
    console.log('Отчёт успешно обновлён.');

    return NextResponse.json({ message: 'Отчёт успешно обновлён' });
  } catch (error) {
    console.error('Ошибка при обновлении отчёта:', error);
    return NextResponse.json(
      { error: 'Не удалось обновить отчёт' },
      { status: 500 }
    );
  }
}

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
    console.log('Подключение к базе данных...');
    await dbConnect();
    console.log('Успешное подключение к базе данных.');

    // Await для параметров маршрута
    const params = await context.params; // Awaiting the params
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
      console.warn('Отчёт не найден.');
      return NextResponse.json({ error: 'Отчёт не найден' }, { status: 404 });
    }

    console.log('Отчёт найден:', report);

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
    console.log('Подключение к базе данных...');
    await dbConnect();
    console.log('Успешное подключение к базе данных.');

    // Await для параметров маршрута
    const params = await context.params; // Awaiting the params
    const { task, baseid } = params;

    console.log(`Task: ${task}, BaseID: ${baseid}`);

    const decodedTask = decodeURIComponent(task);
    const decodedBaseId = decodeURIComponent(baseid);

    console.log(
      `Decoded Task: ${decodedTask}, Decoded BaseID: ${decodedBaseId}`
    );

    // Получаем текущего пользователя
    const user = await currentUser();
    if (!user) {
      console.error('Ошибка аутентификации: Пользователь не аутентифицирован');
      return NextResponse.json(
        { error: 'Пользователь не аутентифицирован' },
        { status: 401 }
      );
    }

    const name = `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim();
    console.log(`Аутентифицированный пользователь: ${name}`);

    // Извлекаем тело запроса
    const body: {
      status?: string;
      issues?: string[];
      updateIssue?: { index: number; text: string };
      deleteIssueIndex?: number;
    } = await request.json();

    console.log('Тело запроса:', body);

    const { status, issues, updateIssue, deleteIssueIndex } = body;

    // Находим отчёт в базе данных
    const report = await Report.findOne({
      task: decodedTask,
      baseId: decodedBaseId,
    });

    if (!report) {
      console.warn('Отчёт не найден.');
      return NextResponse.json({ error: 'Отчёт не найден' }, { status: 404 });
    }

    console.log('Отчёт найден для обновления:', report);

    // Сохраняем старые значения для сравнения
    const oldStatus = report.status;
    const oldIssues = [...report.issues];

    // --- Изменение статуса ---
    if (status && status !== oldStatus) {
      console.log(`Обновление статуса на: ${status}`);
      report.status = status;

      // Добавляем событие в историю изменений
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
      console.log(
        `Обновление замечания по индексу ${index} с текстом: ${text}`
      );
      if (
        index >= 0 &&
        Array.isArray(report.issues) &&
        index < report.issues.length
      ) {
        report.issues[index] = text;
        issuesChanged = true;
      } else {
        console.warn('Неверный индекс для обновления замечания.');
        return NextResponse.json(
          { error: 'Неверный индекс для обновления замечания' },
          { status: 400 }
        );
      }
    }

    if (typeof deleteIssueIndex === 'number') {
      console.log(`Удаление замечания по индексу: ${deleteIssueIndex}`);
      if (
        deleteIssueIndex >= 0 &&
        Array.isArray(report.issues) &&
        deleteIssueIndex < report.issues.length
      ) {
        report.issues.splice(deleteIssueIndex, 1);
        issuesChanged = true;
      } else {
        console.warn('Неверный индекс для удаления замечания.');
        return NextResponse.json(
          { error: 'Неверный индекс для удаления замечания' },
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
        authorId: user.id,
        date: new Date(),
        details: {
          oldIssues,
          newIssues: report.issues,
        },
      });
    }

    // Сохраняем изменения в базе данных
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

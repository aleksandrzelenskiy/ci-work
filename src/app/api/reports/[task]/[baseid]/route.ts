import { NextResponse } from 'next/server';
import clientPromise from '@/utils/mongodb';

export async function GET(
  request: Request,
  context: { params: { task: string; baseid: string } }
) {
  try {
    const { task, baseid } = await context.params; // Явное ожидание params

    const decodedTask = decodeURIComponent(task);
    const decodedBaseId = decodeURIComponent(baseid);

    const client = await clientPromise;
    const db = client.db('photo_reports');
    const collection = db.collection('reports');

    const report = await collection.findOne({
      task: decodedTask,
      baseId: decodedBaseId,
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({
      files: report.files,
      createdAt: report.createdAt,
      userName: report.userName,
      status: report.status,
      issues: report.issues || [], // Возвращаем массив замечаний (если есть)
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
    const { task, baseid } = await context.params; // Явное ожидание params

    const decodedTask = decodeURIComponent(task);
    const decodedBaseId = decodeURIComponent(baseid);

    const client = await clientPromise;
    const db = client.db('photo_reports');
    const collection = db.collection('reports');

    const body: {
      status?: string;
      issues?: string[];
      updateIssue?: { index: number; text: string };
      deleteIssueIndex?: number;
    } = await request.json();

    const { status, issues, updateIssue, deleteIssueIndex } = body;

    // Проверяем, существует ли отчет
    const report = await collection.findOne({
      task: decodedTask,
      baseId: decodedBaseId,
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    // Обновление статуса
    if (status) {
      updateData.status = status;
    }

    // Добавление или обновление списка замечаний
    if (Array.isArray(issues)) {
      const uniqueIssues = Array.from(new Set(issues));
      updateData.issues = uniqueIssues;
    }

    // Изменение текста отдельного замечания
    if (updateIssue) {
      const { index, text } = updateIssue;

      if (
        index >= 0 &&
        Array.isArray(report.issues) &&
        index < report.issues.length
      ) {
        const updatedIssues = [...report.issues];
        updatedIssues[index] = text;
        updateData.issues = updatedIssues;
      } else {
        return NextResponse.json(
          { error: 'Invalid index for issue update' },
          { status: 400 }
        );
      }
    }

    // Удаление замечания
    if (typeof deleteIssueIndex === 'number') {
      if (
        deleteIssueIndex >= 0 &&
        Array.isArray(report.issues) &&
        deleteIssueIndex < report.issues.length
      ) {
        const updatedIssues = [...report.issues];
        updatedIssues.splice(deleteIssueIndex, 1);
        updateData.issues = updatedIssues;
      } else {
        return NextResponse.json(
          { error: 'Invalid index for issue delete' },
          { status: 400 }
        );
      }
    }

    // Если есть данные для обновления
    if (Object.keys(updateData).length > 0) {
      const updateResult = await collection.updateOne(
        { task: decodedTask, baseId: decodedBaseId },
        { $set: updateData }
      );

      if (updateResult.modifiedCount === 0) {
        return NextResponse.json(
          { error: 'Failed to update report' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ message: 'Report updated successfully' });
  } catch (error) {
    console.error('Error updating report:', error);

    return NextResponse.json(
      { error: 'Failed to update report' },
      { status: 500 }
    );
  }
}

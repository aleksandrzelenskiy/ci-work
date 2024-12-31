import { NextResponse } from 'next/server';
import clientPromise from '@/utils/mongodb';

export async function GET(
  request: Request,
  context: { params: { task: string; baseid: string } }
) {
  try {
    // Ожидаем параметры маршрута асинхронно
    const { task, baseid } = await context.params;

    // Декодируем параметры
    const decodedTask = decodeURIComponent(task);
    const decodedBaseId = decodeURIComponent(baseid);

    const client = await clientPromise;
    const db = client.db('photo_reports');
    const collection = db.collection('reports');

    // Логируем запрос для проверки
    console.log('Database Query:', {
      task: decodedTask,
      baseId: decodedBaseId,
    });

    const report = await collection.findOne({
      task: decodedTask,
      baseId: decodedBaseId,
    });

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Успешный ответ
    return NextResponse.json({ files: report.files });
  } catch (error) {
    console.error('Error fetching report:', error);

    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}

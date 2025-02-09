import { NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';

export async function PATCH(request: Request) {
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
    // Извлекаем taskId из URL
    const url = new URL(request.url);
    const taskId = url.pathname.split('/').pop(); // Получаем последний сегмент URL (taskId)

    if (!taskId) {
      return NextResponse.json(
        { error: 'Task ID is required' },
        { status: 400 }
      );
    }

    // Извлекаем статус из тела запроса
    const { status } = await request.json();

    // Обновляем задачу в базе данных
    const updatedTask = await TaskModel.findOneAndUpdate(
      { taskId },
      { status },
      { new: true }
    );

    if (!updatedTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ task: updatedTask });
  } catch (error: unknown) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

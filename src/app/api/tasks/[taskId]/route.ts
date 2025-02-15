// app/api/tasks/[taskid]/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import { currentUser } from '@clerk/nextjs/server';
import type { TaskEvent } from '@/app/types/taskTypes';

// Подключение к базе данных
async function connectToDatabase() {
  try {
    await dbConnect();
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw new Error('Failed to connect to database');
  }
}

// GET-запрос для получения задачи по ID (без изменений)
export async function GET(
  request: Request,
  { params }: { params: { taskid: string } }
) {
  try {
    await connectToDatabase();
    const { taskid } = params;
    const taskIdUpperCase = taskid.toUpperCase();
    const task = await TaskModel.findOne({ taskId: taskIdUpperCase });

    return task
      ? NextResponse.json({ task })
      : NextResponse.json({ error: 'Task not found' }, { status: 404 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PATCH-запрос с добавлением логики событий
export async function PATCH(
  request: Request,
  { params }: { params: { taskid: string } }
) {
  try {
    // Подключение к БД
    await connectToDatabase();

    // Получение и валидация данных
    const { taskid } = params;
    const taskIdUpperCase = taskid.toUpperCase();
    const { status } = await request.json();

    // Получение текущего пользователя
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Поиск задачи
    const task = await TaskModel.findOne({ taskId: taskIdUpperCase });
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Сохранение старого статуса
    const oldStatus = task.status;

    // Создание события только если статус изменен
    if (status && status !== oldStatus) {
      const event: TaskEvent = {
        action: 'STATUS_CHANGED',
        author: `${user.firstName} ${user.lastName}`.trim() || 'Unknown',
        authorId: user.id,
        date: new Date(),
        details: {
          oldStatus,
          newStatus: status,
        },
      };

      // Добавление события в массив
      if (!task.events) task.events = [];
      task.events.push(event);
    }

    // Обновление статуса и сохранение
    task.status = status;
    const updatedTask = await task.save();

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// app/api/tasks/[taskid]/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';

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

// GET-запрос для получения задачи по ID
export async function GET(
  request: Request,
  { params }: { params: { taskid: string } }
) {
  try {
    await connectToDatabase();
  } catch (error) {
    console.error('Connection error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to database' },
      { status: 500 }
    );
  }

  try {
    const { taskid } = params;
    const taskIdUpperCase = taskid.toUpperCase();
    const task = await TaskModel.findOne({ taskId: taskIdUpperCase });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

// PATCH-запрос для обновления статуса задачи
export async function PATCH(
  request: Request,
  { params }: { params: { taskid: string } }
) {
  try {
    await connectToDatabase();
  } catch (error) {
    console.error('Connection error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to database' },
      { status: 500 }
    );
  }

  try {
    const { taskid } = params;
    const taskIdUpperCase = taskid.toUpperCase();
    const { status } = await request.json();
    const updatedTask = await TaskModel.findOneAndUpdate(
      { taskId: taskIdUpperCase },
      { status },
      { new: true }
    );

    if (!updatedTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import UserModel from '@/app/models/UserModel';
import Report from '@/app/models/ReportModel';
import { currentUser } from '@clerk/nextjs/server';
import type { TaskEvent, PriorityLevel } from '@/app/types/taskTypes';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';

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
    const { taskid } = params;
    const taskIdUpperCase = taskid.toUpperCase();

    const task = await TaskModel.findOne({ taskId: taskIdUpperCase });
    if (!task)
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const photoReports = await Report.find({
      reportId: { $regex: `^${taskIdUpperCase}` },
    });

    return NextResponse.json({
      task: { ...task.toObject(), photoReports: photoReports || [] },
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// PATCH-запрос для обновления задачи
export async function PATCH(
  request: Request,
  { params }: { params: { taskid: string } }
) {
  try {
    await connectToDatabase();
    const { taskid } = params;
    const taskId = taskid.toUpperCase();

    // Authentication check
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Find task
    const task = await TaskModel.findOne({ taskId });
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Parse form data
    const formData = await request.formData();

    // Update basic fields
    const updateFields = {
      taskName: formData.get('taskName'),
      bsNumber: formData.get('bsNumber'),
      taskDescription: formData.get('taskDescription'),
      initiatorId: formData.get('initiatorId'),
      executorId: formData.get('executorId'),
      dueDate: formData.get('dueDate'),
      priority: formData.get('priority'),
      status: formData.get('status'),
    };

    if (updateFields.taskName) task.taskName = updateFields.taskName as string;
    if (updateFields.bsNumber) task.bsNumber = updateFields.bsNumber as string;
    if (updateFields.taskDescription) {
      task.taskDescription = updateFields.taskDescription as string;
    }

    // Update initiator information
    if (updateFields.initiatorId) {
      task.initiatorId = updateFields.initiatorId as string;
      const initiator = await UserModel.findOne({
        clerkUserId: updateFields.initiatorId,
      });
      if (initiator) {
        task.initiatorName = initiator.name;
        task.initiatorEmail = initiator.email;
      }
    }

    // Update executor information
    if (updateFields.executorId) {
      task.executorId = updateFields.executorId as string;
      const executor = await UserModel.findOne({
        clerkUserId: updateFields.executorId,
      });
      if (executor) {
        task.executorName = executor.name;
        task.executorEmail = executor.email;
      }
    }

    // Update date and priority
    if (updateFields.dueDate) {
      const dueDate = new Date(updateFields.dueDate as string);
      if (!isNaN(dueDate.getTime())) task.dueDate = dueDate;
    }
    if (updateFields.priority) {
      task.priority = updateFields.priority as PriorityLevel;
    }

    // Handle status changes
    if (updateFields.status && updateFields.status !== task.status) {
      const oldStatus = task.status;
      task.status = updateFields.status as string;

      const statusEvent: TaskEvent = {
        action: 'STATUS_CHANGED',
        author: `${user.firstName} ${user.lastName}`.trim() || 'Unknown',
        authorId: user.id,
        date: new Date(),
        details: {
          oldStatus,
          newStatus: task.status,
        },
      };

      task.events = task.events || [];
      task.events.push(statusEvent);
    }

    // Handle attachments
    const existingAttachments = formData.getAll(
      'existingAttachments'
    ) as string[];
    task.attachments = task.attachments.filter((attachment: string) =>
      existingAttachments.includes(attachment)
    );

    // Process new attachments
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });

    const newAttachments: string[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('attachments_') && value instanceof File) {
        const file = value;
        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `${uuidv4()}-${file.name}`;
        const filePath = join(uploadDir, filename);

        await writeFile(filePath, buffer);
        newAttachments.push(`/uploads/${filename}`);
      }
    }
    task.attachments.push(...newAttachments);

    // Save updated task
    const updatedTask = await task.save();

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

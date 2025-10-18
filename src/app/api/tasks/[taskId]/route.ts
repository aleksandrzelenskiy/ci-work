// app/api/tasks/[taskId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import UserModel from '@/app/models/UserModel';
import Report from '@/app/models/ReportModel';
import { currentUser } from '@clerk/nextjs/server';
import type { PriorityLevel } from '@/app/types/taskTypes';
import { generateClosingDocumentsExcel } from '@/utils/generateExcel';
import { uploadTaskFile, deleteTaskFile } from '@/utils/s3';

interface UpdateData {
  status?: string;
  taskName?: string;
  bsNumber?: string;
  taskDescription?: string;
  initiatorId?: string;
  executorId?: string;
  dueDate?: string;
  priority?: PriorityLevel;
  // поля заказа (фронт шлёт именно их)
  orderNumber?: string;
  orderDate?: string;      // ISO
  orderSignDate?: string;  // ISO
  event?: { details?: { comment?: string } };
  existingAttachments?: string[];
}

async function connectToDatabase() {
  try {
    await dbConnect();
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw new Error('Failed to connect to database');
  }
}

export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ taskId: string }> }
) {
  try {
    await connectToDatabase();
    const { taskId } = await context.params;
    if (!taskId)
      return NextResponse.json({ error: 'No taskId provided' }, { status: 400 });

    const taskIdUpperCase = taskId.toUpperCase();
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
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ taskId: string }> }
) {
  try {
    await connectToDatabase();
    const { taskId } = await context.params;
    if (!taskId)
      return NextResponse.json({ error: 'No taskId provided' }, { status: 400 });

    const taskIdUpperCase = taskId.toUpperCase();

    const user = await currentUser();
    if (!user)
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const task = await TaskModel.findOne({ taskId: taskIdUpperCase });
    if (!task)
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const contentType = request.headers.get('content-type');
    let updateData: UpdateData = {};
    const attachments: File[] = [];

    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      const entries = Array.from(formData.entries());

      const otherData: Record<string, FormDataEntryValue> = {};
      let orderFile: File | null = null;

      for (const [key, value] of entries) {
        if (key.startsWith('attachments_') && value instanceof Blob) {
          attachments.push(value as File);
        } else if (key === 'orderFile' && value instanceof Blob) {
          orderFile = value as File; // <<< ключ, который присылает фронт
        } else {
          otherData[key] = value;
        }
      }

      updateData = Object.fromEntries(
          Object.entries(otherData).map(([k, v]) => [k, v.toString()])
      ) as unknown as UpdateData;

      // attachments (без изменений)
      const maybeExisting = (updateData as unknown as { existingAttachments?: string | string[] }).existingAttachments;
      if (typeof maybeExisting === 'string') {
        try {
          updateData.existingAttachments = JSON.parse(maybeExisting);
        } catch {
          updateData.existingAttachments = [];
        }
      }

      if (attachments.length > 0) {
        const existingAttachments = updateData.existingAttachments || [];
        task.attachments = task.attachments.filter((a: string) =>
            existingAttachments.includes(a)
        );

        const newAttachments: string[] = [];
        for (const file of attachments) {
          const buffer = Buffer.from(await file.arrayBuffer());
          const fileUrl = await uploadTaskFile(
              buffer,
              taskIdUpperCase,
              'attachments',
              `${Date.now()}-${file.name}`,
              file.type || 'application/octet-stream'
          );
          newAttachments.push(fileUrl);
        }
        task.attachments.push(...newAttachments);
      }

      // Сохранение файла заказа (orderFile) -> orderUrl
      if (orderFile) {
        const mime = orderFile.type || 'application/octet-stream';
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(mime) && !mime.startsWith('image/')) {
          return NextResponse.json(
              { error: 'Unsupported file type for orderFile' },
              { status: 400 }
          );
        }

        if (orderFile.size > 20 * 1024 * 1024) {
          return NextResponse.json(
              { error: 'Order file too large (max 20 MB)' },
              { status: 413 }
          );
        }

        const buffer = Buffer.from(await orderFile.arrayBuffer());
        task.orderUrl = await uploadTaskFile(
            buffer,
            taskIdUpperCase,
            'order',
            `${Date.now()}-${orderFile.name}`,
            mime
        );
      }
    } else if (contentType?.includes('application/json')) {
      updateData = (await request.json()) as UpdateData;
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
    }

    // Обновление обычных полей
    if (updateData.taskName) task.taskName = updateData.taskName;
    if (updateData.bsNumber) task.bsNumber = updateData.bsNumber;
    if (updateData.taskDescription) task.taskDescription = updateData.taskDescription;

    if (updateData.initiatorId) {
      const initiator = await UserModel.findOne({ clerkUserId: updateData.initiatorId });
      if (initiator) {
        task.initiatorId = initiator.clerkUserId;
        task.initiatorName = initiator.name;
        task.initiatorEmail = initiator.email;
      }
    }

    if (updateData.executorId) {
      const executor = await UserModel.findOne({ clerkUserId: updateData.executorId });
      if (executor) {
        task.executorId = executor.clerkUserId;
        task.executorName = executor.name;
        task.executorEmail = executor.email;
      }
    }

    if (updateData.dueDate) {
      const d = new Date(updateData.dueDate);
      if (!isNaN(d.getTime())) task.dueDate = d;
    }

    if (updateData.priority) task.priority = updateData.priority as PriorityLevel;

    // Поля заказа
    if (updateData.orderNumber !== undefined) task.orderNumber = updateData.orderNumber;

    if (updateData.orderDate) {
      const d = new Date(updateData.orderDate);
      if (!isNaN(d.getTime())) task.orderDate = d;
    }

    if (updateData.orderSignDate) {
      const d = new Date(updateData.orderSignDate);
      if (!isNaN(d.getTime())) task.orderSignDate = d;
    }

    if (updateData.status?.toLowerCase() === 'agreed') {
      task.closingDocumentsUrl = await generateClosingDocumentsExcel(task);
    }

    const updatedTask = await task.save();
    return NextResponse.json({ task: updatedTask });
  } catch (err) {
    console.error('Error updating task:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
    _request: NextRequest,
    context: { params: Promise<{ taskId: string }> }
) {
  try {
    await connectToDatabase();
    const { taskId } = await context.params;
    if (!taskId)
      return NextResponse.json({ error: 'No taskId provided' }, { status: 400 });

    const user = await currentUser();
    if (!user)
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const taskIdUpperCase = taskId.toUpperCase();
    const task = await TaskModel.findOne({ taskId: taskIdUpperCase });
    if (!task)
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    if (!task.orderUrl)
      return NextResponse.json({ error: 'No order file to delete' }, { status: 400 });

    await deleteTaskFile(task.orderUrl);

    const updatedTask = await TaskModel.findOneAndUpdate(
        { taskId: taskIdUpperCase },
        { $unset: { orderUrl: 1 } },
        { new: true, runValidators: false }
    );

    return NextResponse.json({ task: updatedTask });
  } catch (err) {
    console.error('Error deleting order file:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

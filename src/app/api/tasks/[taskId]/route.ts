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
  executorId?: string | null;
  dueDate?: string;
  priority?: PriorityLevel;
  orderNumber?: string;
  orderDate?: string;      // ISO
  orderSignDate?: string;  // ISO
  event?: { details?: { comment?: string } };
  existingAttachments?: string[];
  // решения исполнителя
  decision?: string;       // 'accept' | 'reject'
  accept?: boolean | string;
  reject?: boolean | string;
}

function toBool(x: unknown): boolean {
  if (typeof x === 'boolean') return x;
  if (typeof x === 'string') {
    const s = x.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'y';
  }
  return false;
}

async function connectToDatabase() {
  try {
    await dbConnect();
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
    if (!taskId) return NextResponse.json({ error: 'No taskId provided' }, { status: 400 });

    const taskIdUpper = taskId.toUpperCase();
    const task = await TaskModel.findOne({ taskId: taskIdUpper });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const photoReports = await Report.find({ reportId: { $regex: `^${taskIdUpper}` } });

    return NextResponse.json({ task: { ...task.toObject(), photoReports: photoReports || [] } });
  } catch (err) {
    console.error('GET task error:', err);
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
    if (!taskId) return NextResponse.json({ error: 'No taskId provided' }, { status: 400 });

    const taskIdUpper = taskId.toUpperCase();

    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const task = await TaskModel.findOne({ taskId: taskIdUpper });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const contentType = request.headers.get('content-type');
    let updateData: UpdateData = {} as UpdateData;
    const attachments: File[] = [];

    // --- form-data ---
    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      const entries = Array.from(formData.entries());

      const otherData: Record<string, FormDataEntryValue> = {};
      let orderFile: File | null = null;

      for (const [key, value] of entries) {
        if (key.startsWith('attachments_') && value instanceof Blob) {
          attachments.push(value as File);
        } else if (key === 'orderFile' && value instanceof Blob) {
          orderFile = value as File;
        } else {
          otherData[key] = value;
        }
      }

      updateData = Object.fromEntries(
          Object.entries(otherData).map(([k, v]) => [k, v.toString()])
      ) as unknown as UpdateData;

      const maybeExisting =
          (updateData as unknown as { existingAttachments?: string | string[] }).existingAttachments;
      if (typeof maybeExisting === 'string') {
        try {
          updateData.existingAttachments = JSON.parse(maybeExisting);
        } catch {
          updateData.existingAttachments = [];
        }
      }

      if (attachments.length > 0) {
        const existing = updateData.existingAttachments || [];
        task.attachments = task.attachments.filter((a: string) => existing.includes(a));

        const newAttachments: string[] = [];
        for (const file of attachments) {
          const buffer = Buffer.from(await file.arrayBuffer());
          const url = await uploadTaskFile(
              buffer,
              taskIdUpper,
              'attachments',
              `${Date.now()}-${file.name}`,
              file.type || 'application/octet-stream'
          );
          newAttachments.push(url);
        }
        task.attachments.push(...newAttachments);
      }

      if (orderFile) {
        const mime = orderFile.type || 'application/octet-stream';
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(mime) && !mime.startsWith('image/')) {
          return NextResponse.json({ error: 'Unsupported file type for orderFile' }, { status: 400 });
        }
        if (orderFile.size > 20 * 1024 * 1024) {
          return NextResponse.json({ error: 'Order file too large (max 20 MB)' }, { status: 413 });
        }

        const buffer = Buffer.from(await orderFile.arrayBuffer());
        task.orderUrl = await uploadTaskFile(
            buffer,
            taskIdUpper,
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

    // === базовые поля ===
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

    // === исполнитель: обновляем ТОЛЬКО если поле присутствует в запросе ===
    let executorRemoved = false;
    let executorAssigned = false;

    if (Object.prototype.hasOwnProperty.call(updateData, 'executorId')) {
      if (updateData.executorId === '' || updateData.executorId === null) {
        // удалить исполнителя
        executorRemoved = true;
        const hadDifferentStatus = task.status !== 'To do';
        task.executorId = '';
        task.executorName = '';
        task.executorEmail = '';

        if (hadDifferentStatus) {
          task.status = 'To do';
          task.events.push({
            action: 'EXECUTOR_REMOVED',
            author: user.fullName || user.username || 'Unknown',
            authorId: user.id,
            date: new Date(),
            details: { comment: 'Executor removed, status reverted to To do' },
          });
        }
      } else if (updateData.executorId) {
        // назначить исполнителя (по clerkUserId)
        const executor = await UserModel.findOne({ clerkUserId: updateData.executorId });
        if (executor) {
          executorAssigned = true;
          task.executorId = executor.clerkUserId;
          task.executorName = executor.name;
          task.executorEmail = executor.email;

          if (task.status === 'To do') {
            // Только TASK_ASSIGNED, без STATUS_CHANGED/EXECUTOR_ASSIGNED
            task.status = 'Assigned';
            task.events.push({
              action: 'TASK_ASSIGNED',
              author: user.fullName || user.username || 'Unknown',
              authorId: user.id,
              date: new Date(),
              details: { comment: `The task is assigned to the executor: ${executor.name}` },
            });
          }
          // Если статус уже не To do (например, пере-назначение) — не плодим события.
        }
      }
    }

    // === даты/приоритет ===
    if (updateData.dueDate) {
      const d = new Date(updateData.dueDate);
      if (!isNaN(d.getTime())) task.dueDate = d;
    }
    if (updateData.priority) task.priority = updateData.priority as PriorityLevel;

    // === Accept / Reject ===
    let decision: 'accept' | 'reject' | null = null;
    if (typeof updateData.decision === 'string') {
      const d = updateData.decision.trim().toLowerCase();
      if (d === 'accept' || d === 'reject') decision = d;
    } else if (toBool(updateData.accept)) decision = 'accept';
    else if (toBool(updateData.reject)) decision = 'reject';

    if (decision === 'accept') {
      if (!task.executorId) {
        return NextResponse.json({ error: 'Cannot accept: no executor assigned' }, { status: 400 });
      }
      if (task.status !== 'At work') {
        task.status = 'At work';
        task.events.push({
          action: 'TASK_ACCEPTED',
          author: user.fullName || user.username || 'Unknown',
          authorId: user.id,
          date: new Date(),
          details: { comment: 'Executor accepted the task. Status → At work' },
        });
      }
    }

    if (decision === 'reject') {
      const hadExecutor = !!task.executorId;
      task.executorId = '';
      task.executorName = '';
      task.executorEmail = '';
      const needRevert = task.status !== 'To do';
      task.status = 'To do';

      task.events.push({
        action: 'TASK_REJECTED',
        author: user.fullName || user.username || 'Unknown',
        authorId: user.id,
        date: new Date(),
        details: { comment: 'Executor rejected the task' },
      });

      if (hadExecutor || needRevert) {
        task.events.push({
          action: 'EXECUTOR_REMOVED',
          author: user.fullName || user.username || 'Unknown',
          authorId: user.id,
          date: new Date(),
          details: { comment: 'Executor removed, status reverted to To do' },
        });
      }
    }

    // === ручная смена статуса (например, Done/Agreed) — только если не менялся исполнитель и не было accept/reject
    if (updateData.status && !executorRemoved && !executorAssigned && !decision) {
      task.status = updateData.status;
      task.events.push({
        action: 'STATUS_CHANGED',
        author: user.fullName || user.username || 'Unknown',
        authorId: user.id,
        date: new Date(),
        details: { comment: `Status changed to: ${updateData.status}` },
      });
    }

    // === поля заказа ===
    if (updateData.orderNumber !== undefined) task.orderNumber = updateData.orderNumber;
    if (updateData.orderDate) {
      const d = new Date(updateData.orderDate);
      if (!isNaN(d.getTime())) task.orderDate = d;
    }
    if (updateData.orderSignDate) {
      const d = new Date(updateData.orderSignDate);
      if (!isNaN(d.getTime())) task.orderSignDate = d;
    }

    // === Excel при Agreed ===
    if (updateData.status?.toLowerCase() === 'agreed' && !decision) {
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
    if (!taskId) return NextResponse.json({ error: 'No taskId provided' }, { status: 400 });

    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const taskIdUpper = taskId.toUpperCase();
    const task = await TaskModel.findOne({ taskId: taskIdUpper });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    if (!task.orderUrl) return NextResponse.json({ error: 'No order file to delete' }, { status: 400 });

    await deleteTaskFile(task.orderUrl);

    const updatedTask = await TaskModel.findOneAndUpdate(
        { taskId: taskIdUpper },
        { $unset: { orderUrl: 1 } },
        { new: true, runValidators: false }
    );

    return NextResponse.json({ task: updatedTask });
  } catch (err) {
    console.error('Error deleting order file:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

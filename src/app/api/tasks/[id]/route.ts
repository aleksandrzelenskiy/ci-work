// app/api/tasks/[id]/route.ts

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
import { notifyTaskAssignment } from '@/app/utils/taskNotifications';
import { splitAttachmentsAndDocuments } from '@/utils/taskFiles';
import { createNotification } from '@/app/utils/notificationService';

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
  orderDate?: string; // ISO
  orderSignDate?: string; // ISO
  orderUrl?: string;
  workCompletionDate?: string; // ISO
  reportLink?: string;
  event?: { details?: { comment?: string } };
  existingAttachments?: string[];
  decision?: string; // 'accept' | 'reject'
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

function buildAuthorName(user: Awaited<ReturnType<typeof currentUser>>, dbName?: string, fallbackEmail?: string) {
  const clerkFullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
  const cleanedDbName = dbName?.trim();
  return (
      clerkFullName ||
      cleanedDbName ||
      user?.username ||
      fallbackEmail ||
      'Unknown'
  );
}

export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    const taskId = id;
    if (!taskId)
      return NextResponse.json({ error: 'No taskId provided' }, { status: 400 });

    const taskIdUpper = taskId.toUpperCase();
    const task = await TaskModel.findOne({ taskId: taskIdUpper });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const photoReports = await Report.find({
      reportId: { $regex: `^${taskIdUpper}` },
    });

    const baseTask = task.toObject();
    const { attachments } = splitAttachmentsAndDocuments(
        baseTask.attachments,
        baseTask.documents
    );

    return NextResponse.json({
      task: {
        ...baseTask,
        attachments,
        documents: undefined,
        photoReports: photoReports || [],
      },
    });
  } catch (err) {
    console.error('GET task error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    const taskId = id;
    if (!taskId)
      return NextResponse.json({ error: 'No taskId provided' }, { status: 400 });

    const taskIdUpper = taskId.toUpperCase();

    const user = await currentUser();
    if (!user)
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const dbCurrentUser = await UserModel.findOne({ clerkUserId: user.id }).lean();
    const authorName = buildAuthorName(user, dbCurrentUser?.name, user.emailAddresses?.[0]?.emailAddress);
    const authorEmail = user.emailAddresses?.[0]?.emailAddress;

    const task = await TaskModel.findOne({ taskId: taskIdUpper });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    // ✅ гарантируем массивы, чтобы ниже не ругался TS
    if (!Array.isArray(task.events)) {
        task.events = [];
    }
    if (!Array.isArray(task.attachments)) {
      task.attachments = [];
    }

    const splitFiles = splitAttachmentsAndDocuments(task.attachments, task.documents);
    task.attachments = splitFiles.attachments;
    task.documents = splitFiles.documents;

    const contentType = request.headers.get('content-type');
    let updateData: UpdateData = {} as UpdateData;
    const attachments: File[] = [];

    // --- form-data ---
    if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      const entries = Array.from(formData.entries());

      const otherData: Record<string, FormDataEntryValue> = {};
      let orderFile: File | null = null;
      let ncwFile: File | null = null;

      for (const [key, value] of entries) {
        if (key.startsWith('attachments_') && value instanceof Blob) {
          attachments.push(value as File);
        } else if (key === 'orderFile' && value instanceof Blob) {
          orderFile = value as File;
        } else if (key === 'ncwFile' && value instanceof Blob) {
          ncwFile = value as File;
        } else {
          otherData[key] = value;
        }
      }

      updateData = Object.fromEntries(
          Object.entries(otherData).map(([k, v]) => [k, v.toString()])
      ) as unknown as UpdateData;

      const maybeExisting = (updateData as unknown as {
        existingAttachments?: string | string[];
      }).existingAttachments;

      if (typeof maybeExisting === 'string') {
        try {
          updateData.existingAttachments = JSON.parse(maybeExisting);
        } catch {
          updateData.existingAttachments = [];
        }
      }

      if (attachments.length > 0) {
        const existing = updateData.existingAttachments || [];

        // уже гарантировано, но оставим
        task.attachments = task.attachments || [];

        // оставляем только те, что были помечены как существующие
        task.attachments = task.attachments.filter((a: string) =>
            existing.includes(a)
        );

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
        const previousOrderUrl = task.orderUrl;
        const newOrderUrl = await uploadTaskFile(
            buffer,
            taskIdUpper,
            'documents',
            `${Date.now()}-${orderFile.name}`,
            mime
        );
        if (previousOrderUrl && previousOrderUrl !== newOrderUrl) {
          try {
            await deleteTaskFile(previousOrderUrl);
          } catch (err) {
            console.error('Failed to remove previous order file', err);
          }
          if (Array.isArray(task.documents)) {
            task.documents = task.documents.filter((d: string) => d !== previousOrderUrl);
          }
          if (Array.isArray(task.attachments)) {
            task.attachments = task.attachments.filter((a: string) => a !== previousOrderUrl);
          }
        }
        task.orderUrl = newOrderUrl;
        if (!Array.isArray(task.documents)) {
          task.documents = [];
        }
        if (!task.documents.includes(newOrderUrl)) {
          task.documents.push(newOrderUrl);
        }
      }

      // === NCW (уведомление) ===
      if (ncwFile) {
        const mime = ncwFile.type || 'application/pdf';
        if (mime !== 'application/pdf') {
          return NextResponse.json(
              { error: 'Unsupported file type for ncwFile (PDF only)' },
              { status: 400 }
          );
        }
        if (ncwFile.size > 20 * 1024 * 1024) {
          return NextResponse.json(
              { error: 'NCW file too large (max 20 MB)' },
              { status: 413 }
          );
        }

        const buffer = Buffer.from(await ncwFile.arrayBuffer());
        task.ncwUrl = await uploadTaskFile(
            buffer,
            taskIdUpper,
            'ncw',
            `${Date.now()}-${ncwFile.name}`,
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
      const initiator = await UserModel.findOne({
        clerkUserId: updateData.initiatorId,
      });
      if (initiator) {
        task.initiatorId = initiator.clerkUserId;
        task.initiatorName = initiator.name;
        task.initiatorEmail = initiator.email;
      }
    }

    // === исполнитель: обновляем ТОЛЬКО если поле присутствует в запросе ===
    const previousExecutorId =
        typeof task.executorId === 'string' && task.executorId.length > 0 ? task.executorId : '';

    let executorRemoved = false;
    let executorAssigned = false;
    let shouldNotifyExecutorAssignment = false;
    let assignedExecutorClerkId: string | null = null;

    if (Object.prototype.hasOwnProperty.call(updateData, 'executorId')) {
      if (updateData.executorId === '' || updateData.executorId === null) {
        executorRemoved = true;
        const hadDifferentStatus = task.status !== 'To do';
        task.executorId = '';
        task.executorName = '';
        task.executorEmail = '';

        if (hadDifferentStatus) {
          task.status = 'To do';
          task.events.push({
            action: 'EXECUTOR_REMOVED',
            author: authorName,
            authorId: user.id,
            date: new Date(),
            details: {
              comment: 'Executor removed, status reverted to To do',
            },
          });
        }
      } else if (updateData.executorId) {
        // назначить исполнителя (по clerkUserId)
        const executor = await UserModel.findOne({
          clerkUserId: updateData.executorId,
        });
        if (executor) {
          executorAssigned = true;
          task.executorId = executor.clerkUserId;
          task.executorName = executor.name;
          task.executorEmail = executor.email;
          if (executor.clerkUserId !== previousExecutorId) {
            shouldNotifyExecutorAssignment = true;
            assignedExecutorClerkId = executor.clerkUserId;
          }

          if (task.status === 'To do') {
            task.status = 'Assigned';
            task.events.push({
              action: 'TASK_ASSIGNED',
              author: authorName,
              authorId: user.id,
              date: new Date(),
              details: {
                comment: `The task is assigned to the executor: ${executor.name}`,
              },
            });
          }
        }
      }
    }

    // === даты/приоритет ===
    if (updateData.dueDate) {
      const d = new Date(updateData.dueDate);
      if (!isNaN(d.getTime())) task.dueDate = d;
    }
    if (updateData.priority) task.priority = updateData.priority as PriorityLevel;

    const notifyManagers = async (
        updatedTask: typeof task,
        action: 'accept' | 'reject',
        newStatus: string
    ) => {
      const possibleManagers = [updatedTask.initiatorId, updatedTask.authorId]
          .map((v) => (typeof v === 'string' ? v.trim() : ''))
          .filter((v) => v && v !== user.id);

      if (possibleManagers.length === 0) return;

      const managerUsers = await UserModel.find({ clerkUserId: { $in: possibleManagers } })
          .select('_id name email clerkUserId')
          .lean();

      if (!managerUsers || managerUsers.length === 0) return;

      const bsInfo = updatedTask.bsNumber ? ` (БС ${updatedTask.bsNumber})` : '';
      const title = action === 'accept' ? 'Исполнитель принял задачу' : 'Исполнитель отказался от задачи';
      const message =
          action === 'accept'
              ? `${authorName} подтвердил принятие задачи «${updatedTask.taskName}»${bsInfo}. Статус: ${newStatus}.`
              : `${authorName} отказался от задачи «${updatedTask.taskName}»${bsInfo}. Статус: ${newStatus}.`;

      const link = `/tasks/${encodeURIComponent(updatedTask.taskId.toLowerCase())}`;
      const metadataEntries = Object.entries({
        taskId: updatedTask.taskId,
        taskMongoId: updatedTask._id?.toString?.(),
        bsNumber: updatedTask.bsNumber,
        newStatus,
        decision: action,
      }).filter(([, value]) => typeof value !== 'undefined' && value !== null);
      const metadata = metadataEntries.length > 0 ? Object.fromEntries(metadataEntries) : undefined;

      await Promise.all(
          managerUsers.map((manager) =>
              createNotification({
                recipientUserId: manager._id,
                type: 'task_status_change',
                title,
                message,
                link,
                orgId: updatedTask.orgId ?? undefined,
                senderName: authorName,
                senderEmail: authorEmail ?? undefined,
                metadata,
              })
          )
      );
    };

    // === Accept / Reject ===
    let decision: 'accept' | 'reject' | null = null;
    let managerDecision: 'accept' | 'reject' | null = null;
    if (typeof updateData.decision === 'string') {
      const d = updateData.decision.trim().toLowerCase();
      if (d === 'accept' || d === 'reject') decision = d;
    } else if (toBool(updateData.accept)) decision = 'accept';
    else if (toBool(updateData.reject)) decision = 'reject';

    if (decision === 'accept') {
      if (!task.executorId) {
        return NextResponse.json(
            { error: 'Cannot accept: no executor assigned' },
            { status: 400 }
        );
      }
      if (task.status !== 'At work') {
        task.status = 'At work';
        task.events.push({
          action: 'TASK_ACCEPTED',
          author: authorName,
          authorId: user.id,
          date: new Date(),
          details: {
            comment: 'Executor accepted the task. Status → At work',
          },
        });
        managerDecision = 'accept';
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
        author: authorName,
        authorId: user.id,
        date: new Date(),
        details: { comment: 'Executor rejected the task' },
      });
      managerDecision = 'reject';

      if (hadExecutor || needRevert) {
        task.events.push({
          action: 'EXECUTOR_REMOVED',
          author: authorName,
          authorId: user.id,
          date: new Date(),
          details: {
            comment: 'Executor removed, status reverted to To do',
          },
        });
      }
    }

    // === ручная смена статуса (если не меняли исполнителя и не было accept/reject)
    if (updateData.status && !executorRemoved && !executorAssigned && !decision) {

      if (updateData.status && !executorRemoved && !executorAssigned && !decision) {

        task.status = updateData.status as typeof task.status;
        task.events.push({
          action: 'STATUS_CHANGED',
          author: authorName,
          authorId: user.id,
          date: new Date(),
          details: { comment: `Status changed to: ${updateData.status}` },
        });
      }

      task.events.push({
        action: 'STATUS_CHANGED',
        author: authorName,
        authorId: user.id,
        date: new Date(),
        details: { comment: `Status changed to: ${updateData.status}` },
      });
    }

    // === поля заказа ===
    if (updateData.orderNumber !== undefined)
      task.orderNumber = updateData.orderNumber;
    if (updateData.orderDate) {
      const d = new Date(updateData.orderDate);
      if (!isNaN(d.getTime())) task.orderDate = d;
    }
    if (updateData.orderSignDate) {
      const d = new Date(updateData.orderSignDate);
      if (!isNaN(d.getTime())) task.orderSignDate = d;
    }
    if (updateData.orderUrl) {
      const prevOrderUrl = task.orderUrl;
      if (prevOrderUrl && prevOrderUrl !== updateData.orderUrl) {
        try {
          await deleteTaskFile(prevOrderUrl);
        } catch (err) {
          console.error('Failed to remove previous order file', err);
        }
        if (Array.isArray(task.documents)) {
          task.documents = task.documents.filter((d: string) => d !== prevOrderUrl);
        }
        if (Array.isArray(task.attachments)) {
          task.attachments = task.attachments.filter((a: string) => a !== prevOrderUrl);
        }
      }
      task.orderUrl = updateData.orderUrl;
      if (!Array.isArray(task.documents)) task.documents = [];
      if (!task.documents.includes(updateData.orderUrl)) {
        task.documents.push(updateData.orderUrl);
      }
    }

    // === дата окончания работ ===
    if (updateData.workCompletionDate) {
      const d = new Date(updateData.workCompletionDate);
      if (!isNaN(d.getTime())) task.workCompletionDate = d;
    }

    // === внешняя ссылка на отчёт ===
    if (updateData.reportLink !== undefined) {
      const v = (updateData.reportLink ?? '').trim();

      if (v) {
        task.reportLink = v;

        if (task.status !== 'Pending') {
          task.events.push({
            action: 'STATUS_CHANGED',
            author: authorName,
            authorId: user.id,
            date: new Date(),
            details: {
              oldStatus: task.status,
              newStatus: 'Pending',
              comment: 'Status changed after adding the photo report link',
            },
          });
          task.status = 'Pending';
        }
      } else {
        task.reportLink = '';
      }
    }

    // === Excel при Agreed ===
    if (updateData.status?.toLowerCase() === 'agreed' && !decision) {
      task.closingDocumentsUrl = await generateClosingDocumentsExcel(task);
    }

    const updatedTask = await task.save();

    if (managerDecision) {
      try {
        await notifyManagers(updatedTask, managerDecision, updatedTask.status);
      } catch (notifyManagerErr) {
        console.error('Failed to notify managers about decision', notifyManagerErr);
      }
    }

    if (shouldNotifyExecutorAssignment && assignedExecutorClerkId) {
      try {
        await notifyTaskAssignment({
          executorClerkId: assignedExecutorClerkId,
          taskId: updatedTask.taskId,
          taskMongoId: updatedTask._id,
          taskName: updatedTask.taskName,
          bsNumber: updatedTask.bsNumber,
          orgId: updatedTask.orgId ? updatedTask.orgId.toString() : undefined,
          triggeredByName: authorName,
          triggeredByEmail: authorEmail,
        });
      } catch (notifyErr) {
        console.error('Failed to send task assignment notification', notifyErr);
      }
    }

    const responseTask =
        typeof (updatedTask as typeof task & { toObject?: () => unknown }).toObject === 'function'
            ? (updatedTask as typeof task & { toObject: () => unknown }).toObject()
            : updatedTask;
    const { attachments: respAttachments, documents: respDocuments } = splitAttachmentsAndDocuments(
        (responseTask as { attachments?: unknown }).attachments,
        (responseTask as { documents?: unknown }).documents
    );

    return NextResponse.json({
      task: {
        ...responseTask,
        attachments: respAttachments,
        documents: respDocuments,
      },
    });
  } catch (err) {
    console.error('Error updating task:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    const { id } = await context.params;
    const taskId = id;
    if (!taskId)
      return NextResponse.json({ error: 'No taskId provided' }, { status: 400 });

    const user = await currentUser();
    if (!user)
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const taskIdUpper = taskId.toUpperCase();
    const task = await TaskModel.findOne({ taskId: taskIdUpper });
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const url = new URL(request.url);
    const fileType = (url.searchParams.get('file') || 'order').toLowerCase();

    if (fileType === 'ncw') {
      if (task.ncwUrl) {
        await deleteTaskFile(task.ncwUrl);
      }

      const updatedTask = await TaskModel.findOneAndUpdate(
          { taskId: taskIdUpper },
          { $unset: { ncwUrl: '', workCompletionDate: '' } },
          { new: true, runValidators: false }
      );

      const respTask =
          updatedTask && typeof updatedTask.toObject === 'function'
              ? updatedTask.toObject()
              : updatedTask;
      let attachments: string[] = [];
      let documents: string[] = [];
      if (respTask && typeof respTask === 'object') {
        const split = splitAttachmentsAndDocuments(
            (respTask as { attachments?: unknown }).attachments,
            (respTask as { documents?: unknown }).documents
        );
        attachments = split.attachments;
        documents = split.documents;
      }

      return NextResponse.json({
        task: respTask
            ? {
              ...respTask,
              attachments,
              documents,
            }
            : null,
      });
    }

    // --- default: order ---
    if (task.orderUrl) {
      await deleteTaskFile(task.orderUrl);
    }

    const pullQuery: Record<string, string> = {};
    if (task.orderUrl) {
      pullQuery.attachments = task.orderUrl;
      pullQuery.documents = task.orderUrl;
    }

    const update: Record<string, unknown> = {
      $unset: {
        orderUrl: '',
        orderNumber: '',
        orderDate: '',
        orderSignDate: '',
      },
    };

    if (Object.keys(pullQuery).length > 0) {
      update.$pull = pullQuery;
    }

    const updatedTask = await TaskModel.findOneAndUpdate(
        { taskId: taskIdUpper },
        update,
        { new: true, runValidators: false }
    );

    const respTask =
        updatedTask && typeof updatedTask.toObject === 'function'
            ? updatedTask.toObject()
            : updatedTask;
    let attachments: string[] = [];
    let documents: string[] = [];
    if (respTask && typeof respTask === 'object') {
      const split = splitAttachmentsAndDocuments(
          (respTask as { attachments?: unknown }).attachments,
          (respTask as { documents?: unknown }).documents
      );
      attachments = split.attachments;
      documents = split.documents;
    }

    return NextResponse.json({
      task: respTask
          ? {
            ...respTask,
            attachments,
            documents,
          }
          : null,
    });
  } catch (err) {
    console.error('Error deleting order/ncw file:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

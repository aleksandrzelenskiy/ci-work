// app/api/tasks/[taskId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
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
import { sendEmail } from '@/utils/mailer';

interface UpdateData {
  status?: string;
  taskName?: string;
  bsNumber?: string;
  taskDescription?: string;
  initiatorId?: string;
  executorId?: string;
  dueDate?: string;
  priority?: PriorityLevel;
  event?: {
    details?: {
      comment?: string;
    };
  };
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

/**
 * GET-запрос для получения задачи по ID
 */
export async function GET(
  request: NextRequest,
  // <–– в сигнатуре указываем params как Promise
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    await connectToDatabase();

    // «Дожидаемся» весь объект params, а затем вытаскиваем taskId
    const { taskId } = await params;
    if (!taskId) {
      return NextResponse.json(
        { error: 'No taskId provided' },
        { status: 400 }
      );
    }

    const taskIdUpperCase = taskId.toUpperCase();

    // Ищем задачу по taskId
    const task = await TaskModel.findOne({ taskId: taskIdUpperCase });
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Ищем репорты, связанные с данной задачей
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

/**
 * PATCH-запрос для обновления задачи
 */
export async function PATCH(
  request: NextRequest,
  // Аналогично для PATCH
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    await connectToDatabase();

    // Дожидаемся params, получаем taskId
    const { taskId } = await params;
    if (!taskId) {
      return NextResponse.json(
        { error: 'No taskId provided' },
        { status: 400 }
      );
    }

    const taskIdUpperCase = taskId.toUpperCase();

    // Проверка аутентификации
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

    // Определяем тип запроса (JSON или FormData)
    const contentType = request.headers.get('content-type');
    let updateData: UpdateData = {};
    const attachments: File[] = [];

    if (contentType?.includes('application/json')) {
      updateData = await request.json();
    } else if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      const entries = Array.from(formData.entries());

      const otherData: Record<string, FormDataEntryValue> = {};
      for (const [key, value] of entries) {
        if (key.startsWith('attachments_') && value instanceof File) {
          attachments.push(value);
        } else {
          otherData[key] = value;
        }
      }

      updateData = Object.fromEntries(
        Object.entries(otherData).map(([k, v]) => [k, v.toString()])
      ) as unknown as UpdateData;

      if (
        updateData.existingAttachments &&
        !Array.isArray(updateData.existingAttachments)
      ) {
        console.error('Invalid existingAttachments format');
        updateData.existingAttachments = [];
      }

      if (otherData.existingAttachments) {
        try {
          updateData.existingAttachments = JSON.parse(
            otherData.existingAttachments.toString()
          );
        } catch (error) {
          console.error('Error parsing existingAttachments:', error);
          updateData.existingAttachments = [];
        }
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported content type' },
        { status: 400 }
      );
    }

    // Логика обновления
    let statusChanged = false;
    let oldStatusForEmail = '';
    let newStatusForEmail = '';
    let commentForEmail = '';

    if (updateData.status) {
      const oldStatus = task.status;
      if (oldStatus !== updateData.status) {
        task.status = updateData.status;

        const statusEvent: TaskEvent = {
          action: 'STATUS_CHANGED',
          author: `${user.firstName} ${user.lastName}`.trim() || 'Unknown',
          authorId: user.id,
          date: new Date(),
          details: {
            oldStatus,
            newStatus: task.status,
            comment: updateData.event?.details?.comment,
          },
        };

        task.events = task.events || [];
        task.events.push(statusEvent);

        statusChanged = true;
        oldStatusForEmail = oldStatus;
        newStatusForEmail = task.status;
        commentForEmail = statusEvent.details?.comment || '';
      }
    }

    if (updateData.taskName) {
      task.taskName = updateData.taskName;
    }
    if (updateData.bsNumber) {
      task.bsNumber = updateData.bsNumber;
    }
    if (updateData.taskDescription) {
      task.taskDescription = updateData.taskDescription;
    }

    // Изменение инициатора
    if (updateData.initiatorId) {
      task.initiatorId = updateData.initiatorId;
      const initiator = await UserModel.findOne({
        clerkUserId: updateData.initiatorId,
      });
      if (initiator) {
        task.initiatorName = initiator.name;
        task.initiatorEmail = initiator.email;
      }
    }

    // Изменение исполнителя
    if (updateData.executorId !== undefined) {
      const previousExecutorId = task.executorId;
      const previousStatus = task.status;

      task.executorId = updateData.executorId;
      const executor = await UserModel.findOne({
        clerkUserId: updateData.executorId,
      });

      if (executor) {
        task.executorName = executor.name;
        task.executorEmail = executor.email;
      } else {
        task.executorName = '';
        task.executorEmail = '';
      }

      if (previousExecutorId !== updateData.executorId) {
        const newStatus = updateData.executorId ? 'Assigned' : 'To do';

        if (previousStatus !== newStatus) {
          task.status = newStatus;

          const statusEvent: TaskEvent = {
            action: 'STATUS_CHANGED',
            author: `${user.firstName} ${user.lastName}`.trim() || 'Unknown',
            authorId: user.id,
            date: new Date(),
            details: {
              oldStatus: previousStatus,
              newStatus,
              comment: executor
                ? `The executor is assigned: ${executor.name}`
                : 'The executor is deleted',
            },
          };

          task.events = task.events || [];
          task.events.push(statusEvent);

          statusChanged = true;
          oldStatusForEmail = previousStatus;
          newStatusForEmail = newStatus;
          commentForEmail = statusEvent.details?.comment || '';
        }
      }
    }

    // Ещё раз, если просто нужно записать executor
    if (updateData.executorId) {
      task.executorId = updateData.executorId;
      const executor = await UserModel.findOne({
        clerkUserId: updateData.executorId,
      });
      if (executor) {
        task.executorName = executor.name;
        task.executorEmail = executor.email;
      }
    }

    if (updateData.dueDate) {
      const dueDate = new Date(updateData.dueDate);
      if (!isNaN(dueDate.getTime())) {
        task.dueDate = dueDate;
      }
    }
    if (updateData.priority) {
      task.priority = updateData.priority as PriorityLevel;
    }

    // Обработка вложений
    if (contentType?.includes('multipart/form-data')) {
      const existingAttachments = updateData.existingAttachments || [];
      task.attachments = task.attachments.filter((attachment: string) =>
        existingAttachments.includes(attachment)
      );

      const uploadDir = join(process.cwd(), 'public', 'uploads');
      await fs.mkdir(uploadDir, { recursive: true });

      const newAttachments: string[] = [];
      for (const file of attachments) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const filename = `${uuidv4()}-${file.name}`;
        const filePath = join(uploadDir, filename);
        await writeFile(filePath, buffer);
        newAttachments.push(`/uploads/${filename}`);
      }
      task.attachments.push(...newAttachments);
    }

    // Сохраняем задачу
    const updatedTask = await task.save();

    // Отправка письма при изменении статуса
    if (statusChanged) {
      try {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const taskLink = `${frontendUrl}/tasks/${updatedTask.taskId}`;

        const recipients = [
          updatedTask.authorEmail,
          updatedTask.initiatorEmail,
          updatedTask.executorEmail,
        ]
          .filter((email) => email && email !== '')
          .filter((value, index, self) => self.indexOf(value) === index);

        for (const email of recipients) {
          let role = 'Другой участник';
          if (email === updatedTask.authorEmail) role = 'Автор';
          else if (email === updatedTask.initiatorEmail) role = 'Инициатор';
          else if (email === updatedTask.executorEmail) role = 'Исполнитель';

          let roleText = '';
          switch (role) {
            case 'Автор':
              roleText = `Вы создали задачу "${updatedTask.taskName}".`;
              break;
            case 'Инициатор':
              roleText = `Вы инициировали задачу "${updatedTask.taskName}".`;
              break;
            case 'Исполнитель':
              roleText = `Задача "${updatedTask.taskName}" назначена на вас.`;
              break;
            default:
              roleText = `Вы участвуете в задаче "${updatedTask.taskName}".`;
          }

          const mainContent = `
Статус изменен с: ${oldStatusForEmail}
На: ${newStatusForEmail}
Автор изменения: ${user.firstName} ${user.lastName}
Комментарий: ${commentForEmail || 'нет'}
Ссылка: ${taskLink}
          `;

          const fullText = `${roleText}\n\n${mainContent}`;
          const fullHtml = `
<p>${roleText}</p>
<p>Статус задачи <strong>"${updatedTask.taskName}"</strong> (${
            updatedTask.taskId
          })</p>
<p>Изменен с: <strong>${oldStatusForEmail}</strong></p>
<p>На: <strong>${newStatusForEmail}</strong></p>
<p>Автор изменения: ${user.firstName} ${user.lastName}</p>
${commentForEmail ? `<p>Комментарий: ${commentForEmail}</p>` : ''}
<p><a href="${taskLink}">Перейти к задаче</a></p>
          `;

          await sendEmail({
            to: email,
            subject: `Статус задачи ${updatedTask.taskId} изменен`,
            text: fullText,
            html: fullHtml,
          });
        }
      } catch (error) {
        console.error('Ошибка отправки уведомлений:', error);
      }
    }

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

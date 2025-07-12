// app/api/tasks/[taskId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
import { generateClosingDocumentsExcel } from '@/utils/generateExcel';

interface UpdateData {
  status?: string;
  taskName?: string;
  bsNumber?: string;
  taskDescription?: string;
  initiatorId?: string;
  executorId?: string;
  dueDate?: string;
  priority?: PriorityLevel;
  orderNumber?: string;
  orderDate?: string;
  orderSignDate?: string;
  // Поле event используется только для статуса
  event?: {
    details?: {
      comment?: string;
    };
  };
  // Поле comment теперь не используется – комментарии добавляются через отдельный эндпоинт
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
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    await connectToDatabase();

    const { taskId } = await context.params;
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
  context: { params: Promise<{ taskId: string }> }
) {
  try {
    await connectToDatabase();

    const { taskId } = await context.params;
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

    if (updateData.orderNumber !== undefined) {
      task.orderNumber = updateData.orderNumber;
    }

    if (updateData.orderDate) {
      const orderDate = new Date(updateData.orderDate);
      if (!isNaN(orderDate.getTime())) {
        task.orderDate = orderDate;
      }
    }

    if (updateData.orderSignDate) {
      const orderSignDate = new Date(updateData.orderSignDate);
      if (!isNaN(orderSignDate.getTime())) {
        task.orderSignDate = orderSignDate;
      }
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

    // Если в updateData.executorId присутствует значение – обновляем исполнителя ещё раз
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

    // Обработка вложений (если multipart/form-data)
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

    // Если статус обновлён на 'agreed', генерируем Excel файл с закрывающими документами
    if (updateData.status && updateData.status.toLowerCase() === 'agreed') {
      const closingUrl = await generateClosingDocumentsExcel(task);
      task.closingDocumentsUrl = closingUrl;
    }

    // Сохраняем задачу
    const updatedTask = await task.save();

    // ----------------------------------------
    // Отправка уведомлений по электронной почте
    // ----------------------------------------
    if (statusChanged) {
      try {
        const frontendUrl = process.env.FRONTEND_URL || 'https://ciwork.ru';
        const taskLink = `${frontendUrl}/tasks/${updatedTask.taskId}`;

        const recipients = [
          updatedTask.authorEmail,
          // updatedTask.initiatorEmail,
          updatedTask.executorEmail,
          //'transport@t2.ru',
        ]
          .filter((email) => email && email !== '')
          .filter((value, index, self) => self.indexOf(value) === index);

        for (const email of recipients) {
          let role = 'Participant';
          if (email === updatedTask.authorEmail) role = 'Author';
          else if (email === updatedTask.initiatorEmail) role = 'Initiator';
          else if (email === updatedTask.executorEmail) role = 'Executor';

          let roleText = '';
          switch (role) {
            case 'Author':
              roleText = `Вы получили это письмо, так как являетесь автором задачи "${updatedTask.taskName} ${updatedTask.bsNumber}" (${updatedTask.taskId}).`;
              break;
            case 'Initiator':
              roleText = `Вы получили это письмо, так как являетесь инициатором задачи "${updatedTask.taskName} ${updatedTask.bsNumber}" (${updatedTask.taskId}).`;
              break;
            case 'Executor':
              roleText = `Вы получили это письмо, так как назначены в качестве исполнителя задачи "${updatedTask.taskName} ${updatedTask.bsNumber}" (${updatedTask.taskId}).`;
              break;
            default:
              roleText = `Информация по задаче "${updatedTask.taskName} ${updatedTask.bsNumber}" (${updatedTask.taskId}).`;
          }

          // Базовый контент
          let mainContent = `
Статус задачи был изменен с: ${oldStatusForEmail}
На: ${newStatusForEmail}
Автор изменения: ${user.firstName} ${user.lastName}
Комментарий: ${commentForEmail || 'нет'}
Ссылка на задачу: ${taskLink}
          `.trim();

          // Если новый статус == 'pending'
          if (newStatusForEmail.toLowerCase() === 'pending') {
            mainContent += `

Исполнитель задачи ${updatedTask.taskId}, ${updatedTask.executorName} добавил фотоочет о выполненной работе.
Ссылка на фотоотчет доступна на <a href="${taskLink}">странице задачи</a>
`.trim();
          }

          // Если новый статус == 'issues'
          if (newStatusForEmail.toLowerCase() === 'issues') {
            mainContent += `

Инициатор задачи ${updatedTask.taskId}, ${updatedTask.initiatorName} добавил замечания к фотоотчету о выполненной работе.
Ссылка на фотоотчет доступна на <a href="${taskLink}">странице задачи</a>
`.trim();
          }

          // Если новый статус == 'fixed'
          if (newStatusForEmail.toLowerCase() === 'fixed') {
            mainContent += `

Исполнитель задачи ${updatedTask.taskId}, ${updatedTask.executorName} добавил фотоотчет о исправлении замечаний к выполненной работе.
Ссылка на фотоотчет доступна на <a href="${taskLink}">странице задачи</a>
`.trim();
          }

          // Если новый статус == 'agreed'
          if (newStatusForEmail.toLowerCase() === 'agreed') {
            mainContent += `

Инициатор задачи ${updatedTask.taskId}, ${updatedTask.initiatorName} согласовал фотоотчет о выполненной работе.
Ссылка на фотоотчет доступна на <a href="${taskLink}">странице задачи</a>. Фотоотчет будет доступен для скачивания в течении 30 дней.
`.trim();
          }

          const fullText = `${roleText}\n\n${mainContent}`;
          // Формируем HTML-версию
          let fullHtml = `
<p>${roleText}</p>
<p>Статус задачи <strong>${updatedTask.taskId}</strong></p>
<p>Изменен с: <strong>${oldStatusForEmail}</strong></p>
<p>На: <strong>${newStatusForEmail}</strong></p>
<p>Автор изменения: ${user.firstName} ${user.lastName}</p>
${commentForEmail ? `<p>Комментарий: ${commentForEmail}</p>` : ''}
<p><a href="${taskLink}">Перейти к задаче</a></p>
`;

          if (newStatusForEmail.toLowerCase() === 'pending') {
            fullHtml += `
<p>Исполнитель задачи ${updatedTask.taskId}, ${updatedTask.executorName} добавил фотоочет о выполненной работе.<br>
Ссылка на фотоотчет доступна на <a href="${taskLink}">странице задачи</a>.</p>
`;
          }

          if (newStatusForEmail.toLowerCase() === 'issues') {
            fullHtml += `
<p>Инициатор задачи ${updatedTask.taskId}, ${updatedTask.initiatorName} добавил замечания к фотоотчету о выполненной работе.<br>
Ссылка на фотоотчет доступна на <a href="${taskLink}">странице задачи</a>.</p>
`;
          }

          if (newStatusForEmail.toLowerCase() === 'fixed') {
            fullHtml += `
<p>Исполнитель задачи ${updatedTask.taskId}, ${updatedTask.executorName} добавил фотоотчет о исправлении замечаний к выполненной работе.<br>
Ссылка на фотоотчет доступна на <a href="${taskLink}">странице задачи</a>.</p>
`;
          }

          if (newStatusForEmail.toLowerCase() === 'agreed') {
            fullHtml += `
<p>Инициатор задачи ${updatedTask.taskId}, ${updatedTask.initiatorName} согласовал фотоотчет о выполненной работе.<br>
Ссылка на фотоотчет доступна на <a href="${taskLink}">странице задачи</a>. Фотоотчет будет доступен для скачивания в течении 30 дней.</p>
`;
          }

          await sendEmail({
            to: email,
            subject: `Статус задачи "${updatedTask.taskName} ${updatedTask.bsNumber}" (${updatedTask.taskId}) изменен`,
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

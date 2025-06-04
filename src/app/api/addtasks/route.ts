/// app/api/addTasks/route.ts

import { NextResponse } from 'next/server';
import Task from 'src/app/models/TaskModel';
import ObjectModel from 'src/app/models/ObjectModel';
import dbConnect from 'src/utils/mongoose';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { PriorityLevel, WorkItem } from 'src/app/types/taskTypes';
import { v4 as uuidv4 } from 'uuid';
import { sendEmail } from 'src/utils/mailer';

function normalizeBsNumber(bsNumber: string): string {
  // Ищем все подстроки формата IR и 6 цифр (например, IR002143)
  const matches = bsNumber.match(/IR\d{6}/gi);

  if (!matches) {
    return '';
  }

  const normalizedParts = matches.map((part) => {
    const regionCode = part.substring(0, 2).toUpperCase(); // IR
    const bsDigits = part.substring(2).replace(/^0+/, ''); // 002143 -> 2143
    const paddedBsDigits = bsDigits.padStart(4, '0');      // 2143 -> 2143 (если уже 4+ знака)
    return `${regionCode}${paddedBsDigits}`;              // IR2143
  });

  return normalizedParts.join('-'); // IR2143-IR9143
}


export async function POST(request: Request) {
  await dbConnect();

  try {
    const formData = await request.formData();

    // Обработка основных полей
    const bsNumber = normalizeBsNumber(formData.get('bsNumber') as string);
    const bsNames = bsNumber.split('-');

    const bsLocation = await Promise.all(
      bsNames.map(async (name) => {
        const object = await ObjectModel.findOne({
          name: new RegExp(`^${name}`),
        });
        if (!object) {
          throw new Error(
            `Базовая станция ${name} не найдена в коллекции objects-t2-ir`
          );
        }
        return {
          name,
          coordinates: object.coordinates,
        };
      })
    );

    const taskData = {
      taskId: formData.get('taskId') as string,
      taskName: formData.get('taskName') as string,
      bsNumber,
      bsLocation,
      bsAddress: formData.get('bsAddress') as string,
      totalCost: parseFloat(formData.get('totalCost') as string),
      priority: formData.get('priority') as PriorityLevel,
      dueDate: new Date(formData.get('dueDate') as string),
      taskDescription: formData.get('taskDescription') as string,
      authorId: formData.get('authorId') as string,
      authorName: formData.get('authorName') as string,
      authorEmail: formData.get('authorEmail') as string,
      initiatorId: formData.get('initiatorId') as string,
      initiatorName: formData.get('initiatorName') as string,
      initiatorEmail: formData.get('initiatorEmail') as string,
      executorId: formData.get('executorId') as string,
      executorName: formData.get('executorName') as string,
      executorEmail: formData.get('executorEmail') as string,
      workItems: JSON.parse(formData.get('workItems') as string).map(
        (item: Omit<WorkItem, 'id'>) => ({
          ...item,
          id: uuidv4(),
        })
      ),
    };

    // Обработка файлов
    const excelFile = formData.get('excelFile') as File;

    // Сбор вложений
    const attachments: File[] = [];
    let index = 0;
    while (formData.has(`attachments_${index}`)) {
      const file = formData.get(`attachments_${index}`) as File;
      attachments.push(file);
      index++;
    }

    // Создание директорий
    const cleanTaskName = taskData.taskName
      .replace(/[^a-z0-9а-яё]/gi, '_')
      .toLowerCase()
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    const cleanBsNumber = taskData.bsNumber
      .replace(/[^a-z0-9-]/gi, '_')
      .toLowerCase()
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    const taskFolderName = `${cleanTaskName}_${cleanBsNumber}`;

    // Сохранение Excel файла
    const orderDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'taskattach',
      taskFolderName,
      'order'
    );
    if (!existsSync(orderDir)) mkdirSync(orderDir, { recursive: true });

    const excelFileName = `order_${Date.now()}${path.extname(excelFile.name)}`;
    writeFileSync(
      path.join(orderDir, excelFileName),
      Buffer.from(await excelFile.arrayBuffer())
    );

    // Сохранение вложений
    const attachmentsDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'taskattach',
      taskFolderName
    );
    if (!existsSync(attachmentsDir)) {
      mkdirSync(attachmentsDir, { recursive: true });
    }

    const attachmentsUrls = await Promise.all(
      attachments.map(async (file, index) => {
        const fileName = `attachment_${Date.now()}_${index}${path.extname(
          file.name
        )}`;
        const filePath = path.join(attachmentsDir, fileName);
        writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));
        return `/uploads/taskattach/${taskFolderName}/${fileName}`;
      })
    );

    // Создание задачи
    const taskStatus = taskData.executorId ? 'Assigned' : 'To do';

    // Базовое событие создания задачи
    const events = [
      {
        action: 'TASK_CREATED',
        author: taskData.authorName,
        authorId: taskData.authorId,
        date: new Date(),
        details: {
          comment: 'The task was created successfully',
          initialStatus: taskStatus,
        },
      },
    ];

    // Дополнительное событие при наличии исполнителя
    if (taskData.executorId) {
      events.push({
        action: 'TASK_ASSIGNED',
        author: taskData.authorName,
        authorId: taskData.authorId,
        date: new Date(),
        details: {
          comment: `The task is assigned to the executor: ${taskData.executorName}`,
          initialStatus: '',
        },
      });
    }

    const newTask = new Task({
      ...taskData,
      status: taskStatus,
      orderUrl: `/uploads/taskattach/${taskFolderName}/order/${excelFileName}`,
      attachments: attachmentsUrls,
      createdAt: new Date(),
      events: events,
    });

    await newTask.save();

    // ==============================
    // Отправка уведомления о новой задаче
    // ==============================
    try {
      // Формируем список получателей: автор, инициатор, исполнитель и общий адрес
      const recipients = [
        newTask.authorEmail,
        // newTask.initiatorEmail,
        newTask.executorEmail,
        'transport@t2.ru',
      ]
        .filter((email) => email && email.trim() !== '')
        .filter((value, index, self) => self.indexOf(value) === index);

      const frontendUrl = process.env.FRONTEND_URL || 'https://ciwork.pro';
      const taskLink = `${frontendUrl}/tasks/${newTask.taskId}`;

      // Берем информацию по задаче
      const creationDate = new Date(newTask.createdAt).toLocaleString('ru-RU');
      const dueDateStr = newTask.dueDate
        ? new Date(newTask.dueDate).toLocaleString('ru-RU')
        : '—';
      const priority = newTask.priority || '—';
      const description = newTask.taskDescription || '—';

      // Текст письма (plain text)
      const textContent = `
Новая задача создана!

ID задачи: ${newTask.taskId}
Название: ${newTask.taskName}
Базовые станции: ${newTask.bsNumber}

Участники задачи:
  • Автор: ${newTask.authorName} (${newTask.authorEmail || '—'})
  • Инициатор: ${newTask.initiatorName || '—'} (${
        newTask.initiatorEmail || '—'
      })
  • Исполнитель: ${newTask.executorName || '—'} (${
        newTask.executorEmail || '—'
      })

Дата создания: ${creationDate}
Срок выполнения: ${dueDateStr}
Приоритет: ${priority}

Описание:
${description}

Ссылка на задачу:
${taskLink}
`.trim();

      // Текст письма (HTML)
      const htmlContent = `
<p><strong>Новая задача создана!</strong></p>
<p><strong>ID задачи:</strong> ${newTask.taskId}</p>
<p><strong>Название:</strong> ${newTask.taskName}</p>
<p><strong>Базовые станции:</strong> ${newTask.bsNumber}</p>

<p><strong>Участники задачи:</strong></p>
<ul>
  <li>Автор: ${newTask.authorName}</li>
  <li>Инициатор: ${newTask.initiatorName || '—'}</li>
  <li>Исполнитель: ${newTask.executorName || '—'}</li>
</ul>

<p><strong>Дата создания:</strong> ${creationDate}</p>
<p><strong>Срок выполнения:</strong> ${dueDateStr}</p>
<p><strong>Приоритет:</strong> ${priority}</p>

<p><strong>Описание:</strong> ${description}</p>

<p><a href="${taskLink}">Перейти к задаче</a></p>
`.trim();

      for (const email of recipients) {
        await sendEmail({
          to: email,
          subject: `Новая задача ${newTask.taskName} ${newTask.bsNumber} (${newTask.taskId})`,
          text: textContent,
          html: htmlContent,
        });
      }
    } catch (emailError) {
      console.error(
        'Ошибка при отправке письма о создании задачи:',
        emailError
      );
    }

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Error when creating a task' },
      { status: 500 }
    );
  }
}

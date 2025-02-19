// app/api/addTasks/route.ts

import { NextResponse } from 'next/server';
import Task from '@/app/models/TaskModel';
import ObjectModel from '@/app/models/ObjectModel';
import dbConnect from '@/utils/mongoose';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { PriorityLevel, WorkItem } from '@/app/types/taskTypes';
import { v4 as uuidv4 } from 'uuid';
import User from '@/app/models/UserModel';

// Функция для нормализации номера базовой станции
function normalizeBsNumber(bsNumber: string): string {
  // Удаляем все символы, кроме букв и цифр
  const cleanedBsNumber = bsNumber.replace(/[^a-zA-Z0-9-]/g, '');

  // Разделяем номер на части по дефису (если есть)
  const parts = cleanedBsNumber.split('-');

  // Нормализуем каждую часть
  const normalizedParts = parts.map((part) => {
    // Извлекаем код региона (первые 2 символа)
    const regionCode = part.substring(0, 2).toUpperCase();
    // Извлекаем номер базовой станции (оставшиеся символы)
    const bsDigits = part.substring(2).replace(/^0+/, ''); // Удаляем ведущие нули
    // Возвращаем нормализованную часть
    return `${regionCode}${bsDigits}`;
  });

  // Соединяем части обратно через дефис
  return normalizedParts.join('-');
}

export async function POST(request: Request) {
  await dbConnect();

  try {
    const formData = await request.formData();

    // Нормализация номера базовой станции
    const bsNumber = normalizeBsNumber(formData.get('bsNumber') as string);

    // Разделение номера на отдельные части (если есть диапазон)
    const bsNames = bsNumber.split('-');

    // Получение координат для каждой базовой станции
    const bsLocation = await Promise.all(
      bsNames.map(async (name) => {
        const object = await ObjectModel.findOne({ name });
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

    // Поиск пользователей по их ID
    const initiatorIdFromForm = formData.get('initiatorId') as string;
    const executorIdFromForm = formData.get('executorId') as string;

    const initiatorUser = await User.findOne({ _id: initiatorIdFromForm });
    const executorUser = await User.findOne({ _id: executorIdFromForm });

    if (!initiatorUser || !executorUser) {
      throw new Error('Initiator or Executor not found');
    }

    // Основные данные задачи
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
      initiatorId: initiatorUser.clerkUserId,
      initiatorName: initiatorUser.name,
      initiatorEmail: initiatorUser.email,
      executorId: executorUser.clerkUserId,
      executorName: executorUser.name,
      executorEmail: executorUser.email,
      workItems: JSON.parse(formData.get('workItems') as string).map(
        (item: Omit<WorkItem, 'id'>) => ({
          ...item,
          id: uuidv4(),
        })
      ),
    };

    // Обработка файлов
    const excelFile = formData.get('excelFile') as File;
    const attachments = Array.from(formData.entries())
      .filter(([key]) => key.startsWith('attachments_'))
      .map(([, file]) => file as File);

    // Нормализация имени директории
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

    // Создание директории
    const taskFolderName = `${cleanTaskName}_${cleanBsNumber}`;

    // Сохраняем Excel файл
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

    // Сохраняем вложения
    const attachmentsDir = path.join(
      process.cwd(),
      'public',
      'uploads',
      'taskattach',
      taskFolderName
    );
    if (!existsSync(attachmentsDir))
      mkdirSync(attachmentsDir, { recursive: true });

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

    // Определяем статус задачи
    const taskStatus = taskData.executorId ? 'assigned' : 'to do';

    // Создаем задачу
    const newTask = new Task({
      ...taskData,
      status: taskStatus,
      orderUrl: `/uploads/taskattach/${taskFolderName}/order/${excelFileName}`,
      attachments: attachmentsUrls,
      createdAt: new Date(),
      events: [
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
      ],
    });

    await newTask.save();

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Error when creating a task' },
      { status: 500 }
    );
  }
}

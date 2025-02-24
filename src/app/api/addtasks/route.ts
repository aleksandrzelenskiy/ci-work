/// app/api/addTasks/route.ts

import { NextResponse } from 'next/server';
import Task from 'src/app/models/TaskModel';
import ObjectModel from 'src/app/models/ObjectModel';
import dbConnect from 'src/utils/mongoose';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { PriorityLevel, WorkItem } from 'src/app/types/taskTypes';
import { v4 as uuidv4 } from 'uuid';

function normalizeBsNumber(bsNumber: string): string {
  // Удаляем информацию о высоте антенной опоры и другие лишние символы
  const cleanedBsNumber = bsNumber
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-zA-Z0-9-]/g, '');

  const parts = cleanedBsNumber.split('-');
  const normalizedParts = parts.map((part) => {
    const regionCode = part.substring(0, 2).toUpperCase(); // Получаем код региона (первые два символа)
    const bsDigits = part.substring(2).replace(/^0+/, ''); // Удаляем ведущие нули

    // Добавляем ведущие нули, чтобы общее количество цифр было 4
    const paddedBsDigits = bsDigits.padStart(4, '0');
    return `${regionCode}${paddedBsDigits}`;
  });

  return normalizedParts.join('-');
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

    // Сбор вложений через последовательный перебор
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

    // Создание задачи
    const taskStatus = taskData.executorId ? 'Assigned' : 'To do';
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

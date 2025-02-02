// app/api/task/route.ts

import { NextResponse } from 'next/server';
import Task from '@/app/models/TaskModel';
import dbConnect from '@/utils/mongoose';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { PriorityLevel } from '@/app/types/taskTypes';

export async function POST(request: Request) {
  await dbConnect();

  try {
    const formData = await request.formData();

    // Основные данные
    const taskData = {
      taskName: formData.get('taskName') as string,
      bsNumber: formData.get('bsNumber') as string,
      bsAddress: formData.get('bsAddress') as string,
      totalCost: parseFloat(formData.get('totalCost') as string),
      priority: formData.get('priority') as PriorityLevel,
      dueDate: new Date(formData.get('dueDate') as string),
      taskDescription: formData.get('taskDescription') as string,
      executor: formData.get('executor') as string,
      initiator: formData.get('initiator') as string,
      workItems: JSON.parse(formData.get('workItems') as string),
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
      .replace(/[^a-z0-9]/gi, '_')
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

    // Создаем задачу
    const newTask = new Task({
      ...taskData,
      orderUrl: `/uploads/taskattach/${taskFolderName}/order/${excelFileName}`,
      attachments: attachmentsUrls,
    });

    await newTask.save();

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Ошибка при создании задачи' },
      { status: 500 }
    );
  }
}

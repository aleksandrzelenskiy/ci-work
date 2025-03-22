// src/utils/generateExcel.ts

import ExcelJS from 'exceljs';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Task } from 'src/app/types/taskTypes';

export async function generateClosingDocumentsExcel(
  task: Task
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Closing Documents');

  // Добавляем заголовок в первой строке и объединяем ячейки A1:C1
  const header = `BS номер: ${task.bsNumber}`;
  worksheet.addRow([header]);
  worksheet.mergeCells('A1:C1');

  // Добавляем строку с заголовками таблицы (начинается со второй строки)
  worksheet.addRow(['', 'Работа', 'Количество']);

  // Настройка ширины столбцов
  worksheet.getColumn(1).width = 5; // пустой столбец
  worksheet.getColumn(2).width = 50; // Работа
  worksheet.getColumn(3).width = 15; // Количество

  // Заполняем таблицу данными из workItems (начиная с третьей строки)
  task.workItems.forEach((item) => {
    worksheet.addRow(['', item.workType, item.quantity]);
  });

  // Формируем путь для сохранения файла
  const cleanTaskName = task.taskName
    .replace(/[^a-z0-9а-яё]/gi, '_')
    .toLowerCase()
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const cleanBsNumber = task.bsNumber
    .replace(/[^a-z0-9-]/gi, '_')
    .toLowerCase()
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const taskFolderName = `${cleanTaskName}_${cleanBsNumber}`;

  // Путь для сохранения файла (например, в папку public/uploads/taskattach/{taskFolderName}/closing)
  const closingDir = path.join(
    process.cwd(),
    'public',
    'uploads',
    'taskattach',
    taskFolderName,
    'closing'
  );

  if (!existsSync(closingDir)) {
    mkdirSync(closingDir, { recursive: true });
  }

  const fileName = `closing_${Date.now()}.xlsx`;
  const filePath = path.join(closingDir, fileName);

  // Сохраняем файл
  await workbook.xlsx.writeFile(filePath);

  // Возвращаем URL, по которому файл будет доступен
  const fileUrl = `/uploads/taskattach/${taskFolderName}/closing/${fileName}`;
  return fileUrl;
}

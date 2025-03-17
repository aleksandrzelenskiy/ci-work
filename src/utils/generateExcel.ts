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

  // Определяем колонки: можно добавлять и другие поля, если нужно
  worksheet.columns = [
    { header: 'Работа', key: 'work', width: 50 },
    { header: 'BS номер', key: 'bsNumber', width: 20 },
    { header: 'Адрес', key: 'address', width: 70 },
  ];

  // Заполняем строки данными из workItems
  task.workItems.forEach((item) => {
    worksheet.addRow({
      work: item.workType,
      bsNumber: task.bsNumber,
      address: task.bsAddress,
    });
  });

  // Определяем папку для сохранения: можно использовать логику, аналогичную созданию taskFolderName
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

  // Формируем путь для сохранения файла (например, в папку public/uploads/taskattach/{taskFolderName}/closing)
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

  // Возвращаем URL, по которому файл будет доступен (учтите, что public является корневой папкой)
  const fileUrl = `/uploads/taskattach/${taskFolderName}/closing/${fileName}`;
  return fileUrl;
}

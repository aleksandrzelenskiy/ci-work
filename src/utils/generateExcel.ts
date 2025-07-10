// src/utils/generateExcel.ts
import ExcelJS from 'exceljs';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Task } from 'src/app/types/taskTypes';

export async function generateClosingDocumentsExcel(task: Task): Promise<string> {
  /* 1. Загружаем шаблон */
  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(process.cwd(), 'templates', 'closing_template.xlsx');
  await workbook.xlsx.readFile(templatePath);           // <-- вместо new Workbook()

  /* 2. Берём нужный лист (по имени или индексу) */
  const worksheet = workbook.getWorksheet('Closing Documents')
      ?? workbook.worksheets[0];             // запасной вариант

  /* 3. Записываем реквизиты в заранее зарезервированные ячейки */
  worksheet.getCell('A1').value = `BS номер: ${task.bsNumber}`;

  /* 4. Определяем, откуда начинается табличная часть
        — например, шаблон хранит строку-шапку во 2-й строке,
        а данные должны начинаться с 3-й */
  const firstDataRow = 3;

  /* 5. Чистим «старые» строки (если шаблон содержит демо-строки) */
  worksheet.spliceRows(firstDataRow, worksheet.rowCount - firstDataRow + 1);

  /* 6. Вставляем строки, при необходимости копируя стили у строки-образца */
  const styleRow = worksheet.getRow(firstDataRow - 1);  // строка-шапка: переносим стили
  task.workItems.forEach((item, idx) => {
    const row = worksheet.insertRow(firstDataRow + idx, ['', item.workType, item.quantity]);
    styleRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      row.getCell(colNumber).style = { ...cell.style }; // копируем стиль столбца
    });
  });

  /* 7. Формируем путь, создаём папку, сохраняем копию */
  const cleanTaskName = task.taskName.replace(/[^a-z0-9а-яё]/gi, '_').toLowerCase()
      .replace(/_+/g, '_').replace(/^_|_$/g, '');
  const cleanBsNumber = task.bsNumber.replace(/[^a-z0-9-]/gi, '_').toLowerCase()
      .replace(/_+/g, '_').replace(/^_|_$/g, '');
  const taskFolderName = `${cleanTaskName}_${cleanBsNumber}`;
  const closingDir = path.join(process.cwd(), 'public', 'uploads', 'taskattach', taskFolderName, 'closing');
  if (!existsSync(closingDir)) mkdirSync(closingDir, { recursive: true });

  const fileName = `closing_${Date.now()}.xlsx`;
  const filePath = path.join(closingDir, fileName);
  await workbook.xlsx.writeFile(filePath);

  /* 8. Отдаём URL для фронта */
  return `/uploads/taskattach/${taskFolderName}/closing/${fileName}`;
}

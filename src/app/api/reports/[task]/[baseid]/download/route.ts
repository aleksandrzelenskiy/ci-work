// app/api/reports/[task]/[baseid]/download/route.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import dbConnect from '@/utils/mongoose';
import Report from '@/app/models/ReportModel';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import { IReport } from '@/app/types/reportTypes';

export const runtime = 'nodejs';

// interface Params {
//   params: {
//     task: string;
//     baseid: string;
//   };
// }

export async function GET(
  request: NextRequest,
  { params }: { params: { task: string; baseid: string } }
) {
  try {
    const { task, baseid } = params;

    console.log(
      `Download request received for task: "${task}", baseid: "${baseid}"`
    );

    // Подключаемся к базе данных
    await dbConnect();
    console.log('Connected to MongoDB');

    // Ищем отчет по task и baseid
    const report = await Report.findOne({
      task,
      baseId: baseid,
    }).lean<IReport>();

    if (!report) {
      return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
    }

    console.log(`Found report: ${report._id}`);

    // Собираем все файлы для добавления в ZIP
    const allFiles = [...report.files, ...report.fixedFiles];
    console.log(`Files to include in ZIP: ${allFiles.join(', ')}`);

    if (allFiles.length === 0) {
      console.warn('No files available for download.');
      return NextResponse.json(
        { error: 'No files available for download.' },
        { status: 400 }
      );
    }

    // Создаем архиватор
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Максимальный уровень сжатия
    });

    // Обработчик ошибок архивации
    archive.on('error', (err) => {
      console.error('Archiving error:', err);
      throw err;
    });

    // Создаем заголовки ответа
    const headers = new Headers({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="report-${baseid}.zip"`,
    });

    // Создаем поток для чтения
    const webStream = new ReadableStream({
      start(controller) {
        archive.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        archive.on('end', () => {
          controller.close();
        });
        archive.on('error', (err) => {
          controller.error(err);
        });

        // Добавляем файлы в архив
        for (const filePath of allFiles) {
          const absolutePath = path.join(process.cwd(), 'public', filePath);
          console.log(`Adding file to archive: ${absolutePath}`);

          if (fs.existsSync(absolutePath)) {
            archive.file(absolutePath, { name: path.basename(filePath) });
            console.log(`Added file: ${absolutePath}`);
          } else {
            console.warn(`File not found and skipped: ${absolutePath}`);
          }
        }

        // Завершаем добавление файлов в архив
        archive.finalize();
      },
    });

    console.log('Starting to stream ZIP archive');

    // Возвращаем поток как ответ
    return new NextResponse(webStream, { headers });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error.' },
      { status: 500 }
    );
  }
}

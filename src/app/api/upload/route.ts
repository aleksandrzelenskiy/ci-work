// app/api/upload/route.ts

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

import { NextResponse } from 'next/server';
import sharp from 'sharp';
import ExifReader from 'exifreader';
import Report from '@/app/models/ReportModel';
import User from '@/app/models/UserModel';
import TaskModel from '@/app/models/TaskModel';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import { uploadBufferToS3 } from '@/utils/s3';
import { v4 as uuidv4 } from 'uuid';

/**
 * Функция для преобразования координат в формат D° M' S" + N/S/E/W
 */
function toDMS(
  degrees: number,
  minutes: number,
  seconds: number,
  isLatitude: boolean
): string {
  const direction = isLatitude
    ? degrees >= 0
      ? 'N'
      : 'S'
    : degrees >= 0
    ? 'E'
    : 'W';
  const absDeg = Math.abs(degrees);
  return `${absDeg}° ${minutes}' ${seconds.toFixed(2)}" ${direction}`;
}

/**
 * Форматирование даты из EXIF в DD.MM.YYYY
 */
function formatDateToDDMMYYYY(exifDateStr: string): string {
  const [datePart] = exifDateStr.split(' ');
  const [yyyy, mm, dd] = datePart.split(':');
  return `${dd}.${mm}.${yyyy}`;
}

export async function POST(request: Request) {
  // Проверка аутентификации
  const user = await currentUser();
  if (!user) {
    console.error('Authentication error: User is not authenticated');
    return NextResponse.json(
      { error: 'User is not authenticated' },
      { status: 401 }
    );
  }

  const name = `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim();

  // Извлечение FormData
  const formData = await request.formData();

  // Декодирование task/baseId
  const rawBaseId = formData.get('baseId') as string | null;
  const rawTask = formData.get('task') as string | null;
  const taskId = formData.get('taskId') as string | null;

  if (!rawBaseId || !rawTask) {
    console.error('Validation error: Base ID or Task is missing');
    return NextResponse.json(
      { error: 'Base ID or Task is missing' },
      { status: 400 }
    );
  }

  // Очищаем пробелы, декодируем
  const baseId = decodeURIComponent(rawBaseId).trim();
  const task = decodeURIComponent(rawTask).trim();

  // Получение initiatorId из FormData
  const initiatorIdFromForm = formData.get('initiatorId') as string | null;
  let initiatorId = 'unknown';
  let initiatorName = 'unknown';

  try {
    if (initiatorIdFromForm) {
      await dbConnect();
      // Ищем пользователя по clerkUserId
      const initiatorUser = await User.findOne({
        clerkUserId: initiatorIdFromForm,
      });
      if (initiatorUser) {
        initiatorId = initiatorUser.clerkUserId;
        initiatorName = initiatorUser.name;
      } else {
        console.warn('Initiator user not found in database');
      }
    }
  } catch (error) {
    console.error('Error fetching initiator user:', error);
  }

  // Используем значения из URL если не нашли в базе
  if (initiatorId === 'unknown') {
    initiatorId = (formData.get('initiatorId') as string) || 'unknown';
    initiatorName = (formData.get('initiatorName') as string) || 'unknown';
  }

  // Файлы
  const files = formData.getAll('image[]') as File[];
  if (files.length === 0) {
    console.error('Validation error: No files uploaded');
    return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
  }

  // Массив итоговых ссылок
  const fileUrls: string[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());

    let date = 'Unknown Date';
    let coordinates = 'Unknown Location';

    // Чтение EXIF
    try {
      const tags = ExifReader.load(buffer);
      if (tags.DateTimeOriginal?.description) {
        const exifDate = tags.DateTimeOriginal.description;
        date = formatDateToDDMMYYYY(exifDate);
      }

      const latitude = tags.GPSLatitude?.value as
        | [[number, number], [number, number], [number, number]]
        | undefined;
      const longitude = tags.GPSLongitude?.value as
        | [[number, number], [number, number], [number, number]]
        | undefined;

      if (latitude && longitude) {
        const latDeg = latitude[0][0];
        const latMin = latitude[1][0];
        const latSec = latitude[2][0] / 100;

        const lonDeg = longitude[0][0];
        const lonMin = longitude[1][0];
        const lonSec = longitude[2][0] / 100;

        const latDMS = toDMS(latDeg, latMin, latSec, true);
        const lonDMS = toDMS(lonDeg, lonMin, lonSec, false);

        coordinates = `${latDMS} | ${lonDMS}`;
      }
    } catch (error) {
      console.warn('Error reading Exif data:', error);
    }

    // Генерация уникального имени выходного файла для S3
    const uniqueId = uuidv4();
    const outputFilename = `${baseId}-${uniqueId}.jpg`;

    try {
      // 1) Изменяем размер и накладываем водяной знак -> получаем Buffer
      const processedBuffer = await sharp(buffer)
        .resize(1920, 1920, {
          fit: sharp.fit.inside,
          withoutEnlargement: true,
        })
        .composite([
          {
            input: Buffer.from(
              `<svg width="900" height="200">
                <rect x="0" y="120" width="900" height="80" fill="black" opacity="0.6" />
                <text x="20" y="150" font-size="20" font-family="Arial, sans-serif" fill="white" text-anchor="start">
                  ${date} | Task: ${task} | BS: ${baseId}
                </text>
                <text x="20" y="180" font-size="20" font-family="Arial, sans-serif" fill="white" text-anchor="start">
                  Location: ${coordinates} | Executor: ${name}
                </text>
              </svg>`
            ),
            gravity: 'southeast',
          },
        ])
        .jpeg({ quality: 80 })
        .toBuffer();

      // 2) Формируем "ключ" для хранения в S3 (папка reports/{task}/{baseId}/)
      const s3Key = `reports/${task}/${baseId}/${outputFilename}`;

      // 3) Загружаем в S3
      const fileUrl = await uploadBufferToS3(
        processedBuffer,
        s3Key,
        'image/jpeg'
      );

      fileUrls.push(fileUrl);
    } catch (error) {
      console.error('Error processing or uploading image:', error);
      return NextResponse.json(
        { error: 'Error processing one or more images' },
        { status: 500 }
      );
    }
  }

  // Сохранение в базу данных
  try {
    await dbConnect(); // убеждаемся, что есть соединение

    // === Проверяем, есть ли уже отчёт для (reportId, task, baseId) ===
    let report = await Report.findOne({
      reportId: taskId || 'unknown',
      task,
      baseId,
    });

    if (report) {
      // Если отчёт существует, просто добавляем новые фото
      report.files.push(...fileUrls);

      report.events.push({
        action: 'REPORT_UPDATED',
        author: name,
        authorId: user.id,
        date: new Date(),
        details: {
          newFiles: fileUrls.length,
          comment: 'Additional photos uploaded',
        },
      });

      // Опционально можно сбросить статус на "Pending" или оставить прежний
      report.status = 'Pending';

      await report.save();
      console.log('Report updated (appended files) successfully.');
    } else {
      // Если отчёта нет, создаём новый
      report = new Report({
        reportId: taskId || 'unknown',
        task,
        baseId,
        executorId: user.id,
        executorName: name,
        initiatorId,
        initiatorName,
        userAvatar: user.imageUrl || '',
        createdAt: new Date(),
        status: 'Pending',
        files: fileUrls,
      });

      report.events.push({
        action: 'REPORT_CREATED',
        author: name,
        authorId: user.id,
        date: new Date(),
        details: {
          fileCount: fileUrls.length,
        },
      });

      await report.save();
      console.log('Report saved to database successfully.');
    }

    // Обновляем статус связанной задачи (по reportId)
    const relatedTask = await TaskModel.findOne({ taskId: report.reportId });
    if (relatedTask) {
      const oldStatus = relatedTask.status;
      relatedTask.status = 'Pending';
      relatedTask.events.push({
        action: 'STATUS_CHANGED',
        author: name,
        authorId: user.id,
        date: new Date(),
        details: {
          oldStatus,
          newStatus: 'Pending',
          comment: 'Статус изменен после загрузки фотоотчета',
        },
      });
      await relatedTask.save();
      console.log('Статус задачи обновлен на Pending');
    }

    return NextResponse.json({
      success: true,
      message: `Photo ${task} | Base ID: ${baseId} uploaded successfully`,
      paths: fileUrls,
    });
  } catch (error) {
    console.error('Error saving report to database:', error);
    return NextResponse.json(
      { error: 'Failed to save report' },
      { status: 500 }
    );
  }
}

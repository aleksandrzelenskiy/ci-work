// app/api/upload/fixed/route.ts

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

import { NextResponse } from 'next/server';
import sharp from 'sharp';
import dbConnect from '@/utils/mongoose';
import ReportModel from '@/app/models/ReportModel';
import { currentUser } from '@clerk/nextjs/server';
import ExifReader from 'exifreader';

// Импорт функции для загрузки в S3
import { uploadBufferToS3 } from '@/utils/s3';

// Функции EXIF / DMS те же
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

function formatDateToDDMMYYYY(exifDateStr: string): string {
  const [datePart] = exifDateStr.split(' ');
  const [yyyy, mm, dd] = datePart.split(':');
  return `${dd}.${mm}.${yyyy}`;
}

export async function POST(request: Request) {
  // Подключаемся к базе
  try {
    await dbConnect();
    console.log('Database connected successfully.');
  } catch (dbError) {
    console.error('Database connection failed:', dbError);
    return NextResponse.json(
      { error: 'Database connection failed' },
      { status: 500 }
    );
  }

  // Проверка аутентификации
  const user = await currentUser();
  if (!user) {
    console.error('Authentication error: User is not authenticated');
    return NextResponse.json(
      { error: 'User is not authenticated' },
      { status: 401 }
    );
  }

  // Определяем имя пользователя
  let name = 'Unknown';
  if (user.firstName && user.lastName) {
    name = `${user.firstName} ${user.lastName}`.trim();
  } else if (user.fullName) {
    name = user.fullName.trim();
  } else if (user.emailAddresses && user.emailAddresses.length > 0) {
    name = user.emailAddresses[0].emailAddress;
  }

  const userId = user.id;

  // Получаем FormData
  const formData = await request.formData();
  const rawBaseId = formData.get('baseId') as string | null;
  const rawTask = formData.get('task') as string | null;

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

  // Файлы
  const files = formData.getAll('image[]') as File[];
  console.log(`Number of files received: ${files.length}`);
  if (files.length === 0) {
    console.error('Validation error: No files uploaded');
    return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
  }

  // Массив итоговых ссылок
  const fileUrls: string[] = [];
  let fileCounter = 1;

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());

    let date = 'Unknown Date';
    let coordinates = 'Unknown Location';

    // Читаем EXIF
    try {
      const tags = ExifReader.load(buffer);
      if (tags.DateTimeOriginal?.description) {
        date = formatDateToDDMMYYYY(tags.DateTimeOriginal.description);
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
      console.warn('Error reading Exif data (fixed):', error);
    }

    // Генерируем уникальное имя
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = file.name.split('.').pop() || 'jpg';
    const outputFilename = `${baseId}-fixed-${String(fileCounter).padStart(
      3,
      '0'
    )}-${uniqueSuffix}.${extension}`;

    try {
      // 1) Sharp -> Buffer
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
                  ISSUES FIXED ${date} | Task: ${task} | BS: ${baseId} | Author: ${name}
                </text>
                <text x="20" y="180" font-size="20" font-family="Arial, sans-serif" fill="white" text-anchor="start">
                  Location: ${coordinates}
                </text>
              </svg>`
            ),
            gravity: 'southeast',
          },
        ])
        .jpeg({ quality: 80 })
        .toBuffer();

      // 2) S3 Key
      const s3Key = `reports/${task}/${baseId}/${baseId} issues fixed/${outputFilename}`;

      // 3) Загрузка в S3
      const fileUrl = await uploadBufferToS3(
        processedBuffer,
        s3Key,
        'image/jpeg'
      );

      fileUrls.push(fileUrl);
      fileCounter++;
    } catch (error) {
      console.error('Error processing image:', error);
      return NextResponse.json(
        { error: 'Error processing one or more images' },
        { status: 500 }
      );
    }
  }

  // Сохранение в базу
  try {
    // Находим отчёт (по тому же task + baseId;)
    const report = await ReportModel.findOne({ task, baseId });

    if (!report) {
      console.error('Report was not found.');
      return NextResponse.json(
        { error: 'Report was not found.' },
        { status: 404 }
      );
    }

    // Добавляем ссылки в fixedFiles
    //
    report.fixedFiles.push(...fileUrls);

    // Ставим статус Fixed
    if (report.status !== 'Fixed') {
      report.status = 'Fixed';
    }

    // Добавляем событие
    report.events.push({
      action: 'FIXED_PHOTOS',
      author: name,
      authorId: userId,
      date: new Date(),
      details: {
        fileCount: fileUrls.length,
      },
    });

    // Сохраняем
    await report.save();

    return NextResponse.json({
      success: true,
      message: `Fixed photo ${task} | Base ID: ${baseId} uploaded successfully`,
      paths: fileUrls,
      report,
    });
  } catch (error) {
    console.error('Error saving report to database:', error);
    return NextResponse.json(
      { error: 'Failed to save report' },
      { status: 500 }
    );
  }
}

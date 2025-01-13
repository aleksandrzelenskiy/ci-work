import { NextResponse } from 'next/server';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import dbConnect from '@/utils/mongoose';
import Report from '@/app/models/Report';
import { currentUser } from '@clerk/nextjs/server';
import ExifReader from 'exifreader';

// Функция для перевода координат в формат D° M' S" + N/S/E/W
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

// Форматируем EXIF дату в DD.MM.YYYY
function formatDateToDDMMYYYY(exifDateStr: string): string {
  // EXIF дата обычно "YYYY:MM:DD HH:MM:SS"
  // Нужно "DD.MM.YYYY"
  const [datePart] = exifDateStr.split(' ');
  const [yyyy, mm, dd] = datePart.split(':');
  return `${dd}.${mm}.${yyyy}`;
}

export async function POST(request: Request) {
  // Подключаемся к БД
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

  // Проверяем аутентификацию
  const user = await currentUser();
  if (!user) {
    console.error('Authentication error: User is not authenticated');
    return NextResponse.json(
      { error: 'User is not authenticated' },
      { status: 401 }
    );
  }

  // Логируем объект user для проверки
  console.log('User object:', user);

  // Получаем имя пользователя
  let name = 'Unknown';
  if (user.firstName && user.lastName) {
    name = `${user.firstName} ${user.lastName}`.trim();
  } else if (user.fullName) {
    name = user.fullName.trim();
  } else if (user.emailAddresses && user.emailAddresses.length > 0) {
    name = user.emailAddresses[0].emailAddress;
  }

  // Извлекаем ID пользователя (обновите поле, если нужно)
  const userId = user.id; // Проверьте правильность этого поля

  console.log('Authenticated user name:', name);
  console.log('Authenticated user ID:', userId);

  // Обрабатываем FormData
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

  const baseId = decodeURIComponent(rawBaseId);
  const task = decodeURIComponent(rawTask);

  // Обрабатываем загруженные файлы
  const files = formData.getAll('image[]') as File[];
  if (files.length === 0) {
    console.error('Validation error: No files uploaded');
    return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
  }

  // Определяем директории
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', task);
  const taskDir = path.join(uploadsDir, baseId);
  const issuesFixedDir = path.join(taskDir, `${baseId} issues fixed`);

  if (!fs.existsSync(issuesFixedDir)) {
    fs.mkdirSync(issuesFixedDir, { recursive: true });
  }

  const fileUrls: string[] = [];
  let fileCounter = 1;

  // Обрабатываем каждый файл
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());

    let date = 'Unknown Date';
    let coordinates = 'Unknown Location';

    // Извлекаем EXIF данные
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

    // Генерируем уникальное имя файла
    const outputFilename = `${baseId}-fixed-${String(fileCounter).padStart(
      3,
      '0'
    )}.jpg`;
    const outputPath = path.join(issuesFixedDir, outputFilename);

    // Обрабатываем изображение с помощью Sharp
    try {
      await sharp(buffer)
        .resize(1280, 1280, {
          fit: sharp.fit.inside,
          withoutEnlargement: true,
        })
        .composite([
          {
            input: Buffer.from(
              `<svg width="900" height="200">
                <rect x="0" y="120" width="900" height="80" fill="black" opacity="0.6" />
                <text x="20" y="150" font-size="20" font-family="Arial, sans-serif" fill="white" text-anchor="start">
                  ${date} | Task: ${task} | BS: ${baseId} | Author: ${name}
                </text>
                <text x="20" y="180" font-size="20" font-family="Arial, sans-serif" fill="white" text-anchor="start">
                  Location: ${coordinates}
                </text>
              </svg>`
            ),
            gravity: 'southeast',
          },
        ])
        .toFile(outputPath);

      const fileUrl = `/uploads/${task}/${baseId}/${baseId} issues fixed/${outputFilename}`;
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

  // Сохраняем ссылки на файлы в базе данных
  try {
    // Обновляем отчет с фиксированными файлами и статусом
    const report = await Report.findOneAndUpdate(
      { task, baseId },
      {
        $push: { fixedFiles: { $each: fileUrls } },
        status: 'Fixed',
        // Если документ создается через upsert, необходимо установить userId и userName
        $setOnInsert: {
          userId: userId,
          userName: name,
        },
      },
      { new: true, upsert: true }
    );

    // Проверяем, был ли создан новый отчет
    if (!report) {
      console.error('Report was not found or created.');
      return NextResponse.json(
        { error: 'Report was not found or created.' },
        { status: 500 }
      );
    }

    // Добавляем событие в историю отчета
    report.events.push({
      action: 'FIXED_PHOTOS',
      author: name,
      authorId: userId, // Добавлено поле authorId
      date: new Date(),
      details: {
        fileCount: fileUrls.length,
      },
    });

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

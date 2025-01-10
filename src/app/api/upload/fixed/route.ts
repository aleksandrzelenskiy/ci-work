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
  await dbConnect();

  // Проверка пользователя
  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'User is not authenticated' },
      { status: 401 }
    );
  }

  const name = `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim();

  // Получаем FormData
  const formData = await request.formData();
  const rawBaseId = formData.get('baseId') as string | null;
  const rawTask = formData.get('task') as string | null;

  if (!rawBaseId || !rawTask) {
    return NextResponse.json(
      { error: 'Base ID or Task is missing' },
      { status: 400 }
    );
  }

  // Декодируем
  const baseId = decodeURIComponent(rawBaseId);
  const task = decodeURIComponent(rawTask);

  // Файлы
  const files = formData.getAll('image[]') as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
  }

  // Папка для «исправленных» фото
  // public/uploads/<task>/<baseId>/<baseId> issues fixed
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', task);
  const baseDir = path.join(uploadsDir, baseId);
  const issuesFixedDir = path.join(baseDir, `${baseId} issues fixed`);

  if (!fs.existsSync(issuesFixedDir)) {
    fs.mkdirSync(issuesFixedDir, { recursive: true });
  }

  const fileUrls: string[] = [];
  let fileCounter = 1;

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Генерируем имя
    const outputFilename = `${baseId}-fixed-${String(fileCounter).padStart(
      3,
      '0'
    )}.jpg`;
    const outputPath = path.join(issuesFixedDir, outputFilename);

    let date = 'Unknown Date';
    let coordinates = 'Unknown Location';

    // Пытаемся прочитать EXIF
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

    // Обрабатываем изображение
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

  // Обновляем/создаём документ в БД, добавляя fixedFiles
  try {
    const report = await Report.findOneAndUpdate(
      { task, baseId },
      {
        $push: { fixedFiles: { $each: fileUrls } },
        status: 'Fixed',
      },
      { new: true, upsert: true }
    );

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

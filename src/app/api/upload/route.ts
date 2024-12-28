import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import ExifReader from 'exifreader';

// Функция для преобразования данных в строку DMS (градусы, минуты, секунды)
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

  return `${degrees}° ${minutes}' ${seconds.toFixed(2)}" ${direction}`;
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const baseId = formData.get('baseId') as string | null;
  const task = formData.get('task') as string | null;

  if (!baseId || !task) {
    return NextResponse.json(
      { error: 'Base ID or Task is missing' },
      { status: 400 }
    );
  }

  const files = formData.getAll('image[]') as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), 'public/uploads', task);
  const taskDir = path.join(uploadsDir, baseId);

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(taskDir)) {
    fs.mkdirSync(taskDir, { recursive: true });
  }

  const fileUrls: string[] = [];
  let fileCounter = 1;

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());

    let date = 'Unknown Date';
    let coordinates = 'Unknown Location';

    try {
      const tags = ExifReader.load(buffer);

      // Извлекаем дату из метаданных
      date = tags.DateTimeOriginal?.description || date;

      // Извлекаем координаты из метаданных
      const latRef = tags.GPSLatitudeRef?.description || '';
      const lonRef = tags.GPSLongitudeRef?.description || '';
      const latitude = tags.GPSLatitude?.value as
        | [[number, number], [number, number], [number, number]]
        | undefined;
      const longitude = tags.GPSLongitude?.value as
        | [[number, number], [number, number], [number, number]]
        | undefined;

      console.log('GPS Data:', { latitude, longitude, latRef, lonRef }); // Логируем данные GPS для отладки

      if (latitude && longitude) {
        const latDeg = latitude[0][0];
        const latMin = latitude[1][0];
        const latSec = latitude[2][0] / 100;

        const lonDeg = longitude[0][0];
        const lonMin = longitude[1][0];
        const lonSec = longitude[2][0] / 100;

        // Преобразуем координаты в формат DMS
        const latDMS = toDMS(latDeg, latMin, latSec, true);
        const lonDMS = toDMS(lonDeg, lonMin, lonSec, false);

        coordinates = `${latDMS} | ${lonDMS}`;
        console.log('DMS Coordinates:', coordinates); // Логируем координаты в формате DMS
      } else {
        console.warn('Invalid coordinates, using default "Unknown Location"');
      }
    } catch (error) {
      console.warn('Error reading Exif data:', error);
    }

    const outputFilename = `${baseId}-${String(fileCounter).padStart(
      3,
      '0'
    )}.jpg`;
    const outputPath = path.join(taskDir, outputFilename);

    try {
      await sharp(buffer)
        .resize(1280, 1280, {
          fit: sharp.fit.inside,
          withoutEnlargement: true,
        })
        .composite([
          {
            input: Buffer.from(
              `<svg width="800" height="200">
                <rect x="0" y="150" width="800" height="50" fill="black" opacity="0.6" />
                <text x="20" y="170" font-size="18" font-family="Arial, sans-serif" fill="white" text-anchor="start">
                  ${date} | Task: ${task} | BS: ${baseId}
                </text>
                <text x="20" y="195" font-size="16" font-family="Arial, sans-serif" fill="white" text-anchor="start">
                  Location: ${coordinates}
                </text>
              </svg>`
            ),
            gravity: 'southeast',
          },
        ])
        .toFile(outputPath);

      const fileUrl = `/uploads/${task}/${baseId}/${outputFilename}`;
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

  return NextResponse.json({
    message: 'Images processed successfully',
    paths: fileUrls,
  });
}

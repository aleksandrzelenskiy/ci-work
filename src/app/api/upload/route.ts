// route.ts
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { NextResponse } from 'next/server';
import ExifReader from 'exifreader';

export const runtime = 'nodejs';

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
    try {
      const tags = ExifReader.load(buffer);
      date = tags.DateTimeOriginal?.description || date;
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
                <text x="20" y="185" font-size="24" fill="white">${date} | Task: ${task} | BS: ${baseId}</text>
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

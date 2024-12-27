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

  const uploadsDir = path.join(process.cwd(), 'public/uploads', baseId);
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const results = [];
  for (const entry of formData.entries()) {
    const [key, value] = entry;
    if (key.startsWith('image-') && value instanceof File) {
      const file = value;
      const buffer = Buffer.from(await file.arrayBuffer());
      const outputPath = path.join(uploadsDir, `${Date.now()}-edited.jpg`);

      try {
        const tags = ExifReader.load(buffer);
        const date = tags.DateTimeOriginal?.description || 'Unknown Date';

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

        results.push({
          message: 'Image processed successfully',
          path: `/uploads/${baseId}/${path.basename(outputPath)}`,
        });
      } catch (error: unknown) {
        console.error('Error processing image:', error);
        return NextResponse.json(
          { error: 'Error processing images' },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json(results);
}

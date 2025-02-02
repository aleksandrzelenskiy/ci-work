// app/api/upload/route.ts

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import ExifReader from 'exifreader';
import Report from '@/models/Report';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';

// Function to convert coordinates to D° M' S" + N/S/E/W format
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

// Format EXIF date to DD.MM.YYYY
function formatDateToDDMMYYYY(exifDateStr: string): string {
  // EXIF: "YYYY:MM:DD HH:MM:SS"
  // Expected: "DD.MM.YYYY"
  const [datePart] = exifDateStr.split(' ');
  const [yyyy, mm, dd] = datePart.split(':');
  return `${dd}.${mm}.${yyyy}`;
}

export async function POST(request: Request) {
  // Check authentication
  const user = await currentUser();
  if (!user) {
    console.error('Authentication error: User is not authenticated');
    return NextResponse.json(
      { error: 'User is not authenticated' },
      { status: 401 }
    );
  }

  const name = `${user.firstName || 'Unknown'} ${user.lastName || ''}`.trim();

  // Extract FormData
  const formData = await request.formData();

  // Decode task/baseId
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

  // Files
  const files = formData.getAll('image[]') as File[];
  if (files.length === 0) {
    console.error('Validation error: No files uploaded');
    return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
  }

  // Prepare directories
  const uploadsDir = path.join(
    process.cwd(),
    'public',
    'uploads',
    'reports',
    task
  );
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

    // Try to read EXIF
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

    // Generate output file name
    const outputFilename = `${baseId}-${String(fileCounter).padStart(
      3,
      '0'
    )}.jpg`;
    const outputPath = path.join(taskDir, outputFilename);

    try {
      // Resize and stamp
      await sharp(buffer)
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
                  Location: ${coordinates} | Author: ${name}
                </text>
              </svg>`
            ),
            gravity: 'southeast',
          },
        ])
        .toFile(outputPath);

      const fileUrl = `/uploads/reports/${task}/${baseId}/${outputFilename}`;
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

  // Connect to the database
  try {
    console.log('Connecting to database...');
    await dbConnect();
    console.log('Database connection successful.');
  } catch (dbError) {
    console.error('Database connection failed:', dbError);
    return NextResponse.json(
      { error: 'Database connection failed' },
      { status: 500 }
    );
  }

  // Save to the database
  try {
    // Create a new report
    const report = new Report({
      task,
      baseId,
      userId: user.id,
      userName: name,
      reviewerId: 'id',
      reviewerName: 'reviewer',
      userAvatar: user.imageUrl || '',
      createdAt: new Date(),
      status: 'Pending',
      files: fileUrls,
    });

    // <-- Add an event to the change history:
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

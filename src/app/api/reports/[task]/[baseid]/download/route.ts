// /app/api/reports/[task]/[baseid]/download/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import Report from '@/app/models/ReportModel';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import { IReport } from '@/app/types/reportTypes';

// Specify Node.js runtime to use Node.js modules
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  context: { params: { task: string; baseid: string } }
) {
  try {
    // Await receiving parameters
    const { task, baseid } = await Promise.resolve(context.params);

    console.log(
      `Download request received for task: "${task}", baseid: "${baseid}"`
    );

    // Connect to the database
    await dbConnect();
    console.log('Connected to MongoDB');

    // Find the report by task and baseid
    const report: IReport | null = await Report.findOne({
      task,
      baseId: baseid,
    }).lean<IReport>();

    if (!report) {
      console.warn(`Report not found for task: "${task}", baseid: "${baseid}"`);
      return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
    }

    console.log(`Found report: ${report._id}`);

    // Gather all files to include in the ZIP
    const allFiles = [...report.files, ...report.fixedFiles];
    console.log(`Files to include in ZIP: ${allFiles.join(', ')}`);

    if (allFiles.length === 0) {
      console.warn('No files available for download.');
      return NextResponse.json(
        { error: 'No files available for download.' },
        { status: 400 }
      );
    }

    // Create the archiver
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression level
    });

    // Archiving error handler
    archive.on('error', (err) => {
      console.error('Archiving error:', err);
      throw err;
    });

    // Create response headers
    const headers = new Headers({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="report-${baseid}.zip"`,
    });

    // Create a web stream
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

        // Add files to the archive
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

        // Finish adding files to the archive
        archive.finalize();
      },
    });

    console.log('Starting to stream ZIP archive');

    // Return the stream as a response
    return new NextResponse(webStream, { headers });
  } catch (error) {
    console.error('Error downloading report:', error);
    return NextResponse.json(
      { error: 'Internal Server Error.' },
      { status: 500 }
    );
  }
}

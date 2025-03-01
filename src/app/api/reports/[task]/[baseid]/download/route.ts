// app/api/reports/[task]/[baseid]/download/route.ts

import { NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import Report from '@/app/models/ReportModel';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import { IReport } from '@/app/types/reportTypes';

// Указываем среду выполнения (Node.js), если нужно
export const runtime = 'nodejs';

/**
 * Важно:
 *  1) Вторым аргументом Route Handler'а идёт объект, где указываем params.
 *  2) Тип обычно можно описать как { params: { ... } }, если вы используете Request из Web API.
 *  3) Если нужно NextRequest, типизировать надо через собственный контекст либо через тип RouteHandlerContext.
 */
export async function GET(
  request: Request,
  { params }: { params: { task: string; baseid: string } }
) {
  try {
    const { task, baseid } = params;

    await dbConnect();
    const report = await Report.findOne({
      task,
      baseId: baseid,
    }).lean<IReport>();

    if (!task || !baseid) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    if (!report) {
      return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
    }

    const allFiles = [...report.files, ...report.fixedFiles];
    if (allFiles.length === 0) {
      return NextResponse.json(
        { error: 'No files available for download.' },
        { status: 400 }
      );
    }

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      throw err;
    });

    const headers = new Headers({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="report-${baseid}.zip"`,
    });

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

        for (const filePath of allFiles) {
          const absolutePath = path.join(process.cwd(), 'public', filePath);
          if (fs.existsSync(absolutePath)) {
            archive.file(absolutePath, { name: path.basename(filePath) });
          }
        }

        archive.finalize();
      },
    });

    return new NextResponse(webStream, { headers });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error.' },
      { status: 500 }
    );
  }
}

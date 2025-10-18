// app/api/estimates/route.ts

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// Тип для строки Excel данных
type ExcelRow = Record<string, unknown>;
type SheetData = Array<ExcelRow>;

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'Файл не найден' }, { status: 400 });
        }

        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
        ];

        if (!validTypes.includes(file.type)) {
            return NextResponse.json(
                {
                    error: 'Неверный формат файла. Загрузите файл Excel (XLSX или XLS).',
                },
                { status: 400 }
            );
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'buffer' });

        const result: Record<string, SheetData> = {};

        workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const data: SheetData = XLSX.utils.sheet_to_json(worksheet);
            result[sheetName] = data;
        });

        return NextResponse.json({
            success: true,
            fileName: file.name,
            data: result,
        });
    } catch (error) {
        console.error('Ошибка обработки файла:', error);
        return NextResponse.json(
            { error: 'Внутренняя ошибка сервера при обработке файла' },
            { status: 500 }
        );
    }
}
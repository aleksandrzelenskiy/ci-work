import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import ReportModel from '@/app/models/ReportModel';
import dotenv from 'dotenv';

dotenv.config();

// Настройка S3
const s3 = new S3Client({
    region: process.env.AWS_S3_REGION!,
    endpoint: process.env.S3_ENDPOINT!,
    credentials: {
        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY!,
    },
});

const BUCKET = process.env.AWS_S3_BUCKET!;

/** Удаляет один отчёт и связанные с ним файлы */
export async function deleteSingleReport(reportIdOrObjectId: string) {
    const report =
        (await ReportModel.findOne({ reportId: reportIdOrObjectId })) ||
        (await ReportModel.findById(reportIdOrObjectId));

    if (!report) {
        throw new Error(`Report ${reportIdOrObjectId} not found`);
    }

    const files = report.files ?? [];

    for (const fileUrl of files) {
        const key = fileUrl.split(`${BUCKET}/`)[1];
        if (!key) continue;

        try {
            await s3.send(
                new DeleteObjectCommand({
                    Bucket: BUCKET,
                    Key: decodeURIComponent(key),
                })
            );
            console.log(`Удалён файл: ${key}`);
        } catch (err) {
            console.error(`Ошибка при удалении файла ${key}:`, err);
        }
    }

    await ReportModel.deleteOne({ _id: report._id });
    console.log(`Отчёт ${report._id} удалён`);
}

/** Удаляет все отчёты и их файлы (bulk delete) */
export async function deleteAllReports() {
    const reports = await ReportModel.find();
    const allFiles = reports.flatMap((report) => report.files ?? []);

    for (const fileUrl of allFiles) {
        const key = fileUrl.split(`${BUCKET}/`)[1];
        if (!key) continue;

        try {
            await s3.send(
                new DeleteObjectCommand({
                    Bucket: BUCKET,
                    Key: decodeURIComponent(key),
                })
            );
            console.log(`Удалён файл: ${key}`);
        } catch (err) {
            console.error(`Ошибка при удалении файла ${key}:`, err);
        }
    }

    await ReportModel.deleteMany({});
    console.log('Все отчёты удалены из MongoDB');
}

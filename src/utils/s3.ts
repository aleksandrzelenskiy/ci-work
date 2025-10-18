// src/app/utils/s3.ts
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

// --- ENV config ---
const BUCKET = process.env.AWS_S3_BUCKET;
const REGION = process.env.AWS_S3_REGION;
const ENDPOINT = process.env.AWS_S3_ENDPOINT;
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

const useS3 = !!(BUCKET && REGION && ENDPOINT && ACCESS_KEY_ID && SECRET_ACCESS_KEY);

let s3: S3Client | null = null;

if (useS3) {
  s3 = new S3Client({
    region: REGION!,
    endpoint: ENDPOINT!,
    forcePathStyle: true, // необходимо для REG.RU, Yandex Object Storage, MinIO
    credentials: {
      accessKeyId: ACCESS_KEY_ID!,
      secretAccessKey: SECRET_ACCESS_KEY!,
    },
  });
  console.log('✅ Using S3 storage');
} else {
  console.log('⚙️ Using local file storage (no S3 config found)');
}

/**
 * Формирует путь вида:
 * uploads/<taskId>/<taskId>-<subfolder>/<filename>
 */
function buildFileKey(taskId: string, subfolder: string, filename: string): string {
  const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeName = path.basename(filename);
  return path.posix.join('uploads', `${safeTaskId}`, `${safeTaskId}-${subfolder}`, safeName);
}

/**
 * Универсальная функция загрузки файла (локально или S3)
 */
export async function uploadTaskFile(
    fileBuffer: Buffer,
    taskId: string,
    subfolder: 'estimate' | 'attachments' | 'order' | 'comments',
    filename: string,
    contentType: string
): Promise<string> {
  const key = buildFileKey(taskId, subfolder, filename);

  try {
    // === 1. S3 ===
    if (s3 && BUCKET) {
      const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        ACL: 'public-read',
      });
      await s3.send(command);
      const url = `${ENDPOINT!.replace(/\/+$/, '')}/${BUCKET}/${key}`;
      console.log(`✅ Uploaded to S3: ${url}`);
      return url;
    }

    // === 2. Local fallback ===
    const uploadsRoot = path.join(process.cwd(), 'public');
    const fullPath = path.join(uploadsRoot, key);
    const dir = path.dirname(fullPath);

    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, fileBuffer);

    const localUrl = `/${key.replace(/\\/g, '/')}`;
    console.log(`💾 Saved locally: ${localUrl}`);
    return localUrl;
  } catch (error) {
    console.error('Ошибка при сохранении файла:', error);
    throw error;
  }
}

/**
 * Удаление файла по публичному URL (локально или S3)
 */
export async function deleteTaskFile(publicUrl: string): Promise<void> {
  try {
    // === 1. S3 ===
    if (s3 && BUCKET) {
      const base = ENDPOINT!.replace(/\/+$/, '');
      const prefix = `${base}/${BUCKET}/`;
      if (!publicUrl.startsWith(prefix)) {
        console.warn('⚠️ URL не совпадает с S3-префиксом, пропускаем удаление');
        return;
      }
      const key = publicUrl.slice(prefix.length);
      const cmd = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
      await s3.send(cmd);
      console.log(`🗑️ Deleted from S3: ${publicUrl}`);
      return;
    }

    // === 2. Local fallback ===
    const uploadsRoot = path.join(process.cwd(), 'public');
    const relative = publicUrl.replace(/^\/+/, '');
    const localPath = path.join(uploadsRoot, relative);

    if (fs.existsSync(localPath)) {
      await fs.promises.unlink(localPath);
      console.log(`🗑️ Deleted locally: ${localPath}`);
    } else {
      console.log(`ℹ️ Local file not found: ${localPath}`);
    }
  } catch (err) {
    console.error('Ошибка при удалении файла:', err);
  }
}

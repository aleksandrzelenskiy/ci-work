// src/utils/s3.ts
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  ObjectIdentifier,
} from '@aws-sdk/client-s3';
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
    forcePathStyle: true, // REG.RU / YOS / MinIO
    credentials: {
      accessKeyId: ACCESS_KEY_ID!,
      secretAccessKey: SECRET_ACCESS_KEY!,
    },
  });
  console.log('✅ Using S3 storage');
} else {
  console.log('⚙️ Using local file storage (no S3 config found)');
}

/** Универсальный публичный URL для ключа */
function publicUrlForKey(key: string): string {
  if (s3 && BUCKET && ENDPOINT) {
    return `${ENDPOINT.replace(/\/+$/, '')}/${BUCKET}/${key}`;
  }
  // локальный режим: кладём в /public и отдаём как /<key>
  return `/${key.replace(/\\/g, '/')}`;
}

/** Гарантируем существование локальной директории под ключ */
function ensureLocalDirForKey(key: string): string {
  const full = path.join(process.cwd(), 'public', key);
  const dir = path.dirname(full);
  fs.mkdirSync(dir, { recursive: true });
  return full;
}

// Нормализация имени файла: убираем слеши/лишние пробелы и пытаемся починить latin1-кодировку
function normalizeFilename(raw: string): string {
  let base = path.basename(raw || 'file');
  const suspect = /[ÃÐÒÑÂäöüÄÖÜß]/.test(base);
  if (suspect) {
    try {
      const fixed = Buffer.from(base, 'latin1').toString('utf8');
      if (/[А-Яа-яЁё]/.test(fixed)) {
        base = fixed;
      }
    } catch {
      /* ignore */
    }
  }
  base = base.replace(/[/\\]+/g, '_').replace(/\s+/g, ' ').trim();
  return base || 'file';
}

/**
 * Загрузка по готовому ключу (используется в pages/api/upload.ts)
 * Возвращает ПУБЛИЧНЫЙ URL string.
 */
export async function uploadBuffer(
    fileBuffer: Buffer,
    key: string,
    contentType: string
): Promise<string> {
  if (s3 && BUCKET) {
    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'public-read', // если нужен приват — уберите
    });
    await s3.send(cmd);
    const url = publicUrlForKey(key);
    console.log(`✅ Uploaded to S3: ${url}`);
    return url;
  }

  // Локальный режим
  const fullPath = ensureLocalDirForKey(key);
  await fs.promises.writeFile(fullPath, fileBuffer);
  const url = publicUrlForKey(key);
  console.log(`💾 Saved locally: ${url}`);
  return url;
}

/** Сборка ключа вида: uploads/<TASKID>/<TASKID>-<subfolder>/<filename> */
function sanitizeTaskId(taskId: string): string {
  return taskId.replace(/[^a-zA-Z0-9_-]/g, '');
}

function buildFileKey(taskId: string, subfolder: string, filename: string): string {
  const safeTaskId = sanitizeTaskId(taskId);
  const safeName = normalizeFilename(filename);
  return path.posix.join('uploads', `${safeTaskId}`, `${safeTaskId}-${subfolder}`, safeName);
}

/**
 * Загрузка файла задачи в S3/локально.
 * subfolder — один из предопределённых подкаталогов;
 * ключ остаётся в формате uploads/<TASKID>/<TASKID>-<subfolder>/<filename>.
 */
export async function uploadTaskFile(
    fileBuffer: Buffer,
    taskId: string,
    subfolder: 'estimate' | 'attachments' | 'order' | 'comments' | 'ncw' | 'documents',
    filename: string,
    contentType: string
): Promise<string> {
  const key = buildFileKey(taskId, subfolder, filename);

  if (s3 && BUCKET) {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'public-read',
    });
    await s3.send(command);
    const url = publicUrlForKey(key);
    console.log(`✅ Uploaded to S3: ${url}`);
    return url;
  }

  // Локальный режим
  const fullPath = ensureLocalDirForKey(key);
  await fs.promises.writeFile(fullPath, fileBuffer);
  const url = publicUrlForKey(key);
  console.log(`💾 Saved locally: ${url}`);
  return url;
}

/** Удаление файла по публичному URL (S3 или локально) */
export async function deleteTaskFile(publicUrl: string): Promise<void> {
  try {
    if (s3 && BUCKET && ENDPOINT) {
      const base = ENDPOINT.replace(/\/+$/, '');
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

    // локальный режим
    const relative = publicUrl.replace(/^\/+/, '');
    const localPath = path.join(process.cwd(), 'public', relative);
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

/** Полное удаление папки задачи uploads/<TASKID>/ со всеми вложениями (S3 или локально) */
export async function deleteTaskFolder(taskId: string): Promise<void> {
  const safeTaskId = sanitizeTaskId(taskId);
  if (!safeTaskId) {
    console.warn('⚠️ Пустой taskId, пропускаем удаление папки');
    return;
  }

  const prefix = `${path.posix.join('uploads', safeTaskId)}/`;

  if (s3 && BUCKET) {
    let continuationToken: string | undefined = undefined;

    do {
      const { Contents = [], IsTruncated, NextContinuationToken } =
        await s3.send(new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })) as ListObjectsV2CommandOutput;

      const keys = Contents.map(({ Key }) => Key).filter(
        (key): key is string => typeof key === 'string' && key.trim().length > 0
      );

      if (keys.length > 0) {
        const deleteCmd = new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: {
            Objects: keys.map(
              (Key): ObjectIdentifier => ({
                Key,
              })
            ),
            Quiet: true,
          },
        });
        await s3.send(deleteCmd);
        console.log(`🗑️ Deleted ${keys.length} objects from S3 prefix ${prefix}`);
      }

      continuationToken = IsTruncated ? NextContinuationToken : undefined;
    } while (continuationToken);

    return;
  }

  const localDir = path.join(process.cwd(), 'public', prefix);
  await fs.promises.rm(localDir, { recursive: true, force: true });
  console.log(`🗑️ Deleted local task folder: ${localDir}`);
}

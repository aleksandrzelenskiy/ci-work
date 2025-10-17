// src/app/utils/s3.ts

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

const BUCKET = process.env.AWS_S3_BUCKET;
const REGION = process.env.AWS_S3_REGION;
const ENDPOINT = process.env.AWS_S3_ENDPOINT;
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

const useS3 =
    BUCKET && REGION && ENDPOINT && ACCESS_KEY_ID && SECRET_ACCESS_KEY;

let s3: S3Client | null = null;

if (useS3) {
  s3 = new S3Client({
    region: REGION,
    endpoint: ENDPOINT,
    forcePathStyle: true, // обязательно для REG.RU
    credentials: {
      accessKeyId: ACCESS_KEY_ID!,
      secretAccessKey: SECRET_ACCESS_KEY!,
    },
  });
  console.log('✅ Using S3 storage');
} else {
  console.log('⚙️ Using local file storage (no S3 config found)');
}

export async function uploadBuffer(
    fileBuffer: Buffer,
    key: string,
    contentType: string
): Promise<string> {
  try {
    // === 1. Если доступен S3 ===
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

    // === 2. Если S3 недоступен — сохраняем локально ===
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const filePath = path.join(uploadsDir, key.replace(/^reports[\\/]/, ''));
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(filePath, fileBuffer);
    const localUrl = `/uploads/${key.replace(/^reports[\\/]/, '')}`;

    console.log(`💾 Saved locally: ${localUrl}`);
    return localUrl;
  } catch (error) {
    console.error('Ошибка при сохранении файла:', error);
    throw error;
  }
}

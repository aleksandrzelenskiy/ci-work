// utils/s3.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.S3_BUCKET_NAME!;
const REGION = process.env.S3_REGION!;

const s3 = new S3Client({
  region: REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export async function uploadBufferToS3(
  fileBuffer: Buffer,
  key: string,
  contentType: string
) {
  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key, // Имя файла/ключ в S3
      Body: fileBuffer, // Содержимое файла (Buffer)
      ContentType: contentType,
      ACL: 'public-read',
    });
    await s3.send(command);

    // Формируем публичный URL
    const fileUrl = `${process.env.S3_ENDPOINT!.replace(
      /\/+$/,
      ''
    )}/${BUCKET}/${key}`;
    return fileUrl;
  } catch (error) {
    console.error('Ошибка при загрузке в S3:', error);
    throw error;
  }
}

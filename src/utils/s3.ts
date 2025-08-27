// src/app/utils/s3.ts

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.AWS_S3_BUCKET!;
const REGION = process.env.AWS_S3_REGION!;
const ENDPOINT = process.env.AWS_S3_ENDPOINT!;
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID!;
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY!;

console.log('REGION:', REGION);
console.log('BUCKET:', BUCKET);
console.log('ENDPOINT:', ENDPOINT);

const s3 = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  forcePathStyle: true, // обязательно для REG.RU
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
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
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'public-read',
    });

    await s3.send(command);

    return `${ENDPOINT.replace(/\/+$/, '')}/${BUCKET}/${key}`;

  } catch (error) {
    console.error('Ошибка при загрузке в S3:', error);
    throw error;
  }
}

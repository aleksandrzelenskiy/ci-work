// src/types/index.ts

export interface UploadResponse {
  message: string;
  path: string;
}

export interface ExifData {
  date: string;
  gps: string;
}

// Декларация расширения для NodeJS:
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EMAIL_HOST: string;
      EMAIL_PORT: string;
      EMAIL_USER: string;
      EMAIL_PASS: string;
      EMAIL_SECURE?: 'true' | 'false';
      EMAIL_FROM?: string;
    }
  }
}

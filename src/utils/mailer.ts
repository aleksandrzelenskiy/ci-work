// src/utils/mailer.ts

import nodemailer, { TransportOptions } from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Создаём и возвращаем transporter для отправки писем.
 */
function createTransporter() {
  // Читаем переменные из .env:
  const host = process.env.EMAIL_HOST || '';
  const port = parseInt(process.env.EMAIL_PORT || '465', 10);
  const user = process.env.EMAIL_USER || '';
  const pass = process.env.EMAIL_PASS || '';
  // Если EMAIL_SECURE='true' — будет true, иначе false:
  const secure = process.env.EMAIL_SECURE === 'true';

  // Логируем конфигурацию для проверки корректности переменных
  console.log('Email config:', { host, port, user, secure });

  // Создаём и возвращаем transporter с включёнными опциями логирования и отладки
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: true, // Включаем логирование
    debug: true, // Включаем режим отладки
    tls: {
      // Если сервер использует самоподписанный сертификат, временно отключаем проверку
      rejectUnauthorized: false,
    },
  } as TransportOptions);
}

/**
 * Функция для отправки писем
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const transporter = createTransporter();
  const from = process.env.EMAIL_FROM || 'CI Work <no-reply@example.com>';

  const mailData = {
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  };

  try {
    const info = await transporter.sendMail(mailData);
    console.log('Message sent: %s', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Email sending failed');
  }
}

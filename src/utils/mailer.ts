// src/utils/mailer.ts

import nodemailer, { TransportOptions } from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Транспортер
 */
function createTransporter() {
  const host = process.env.EMAIL_HOST || '';
  const port = parseInt(process.env.EMAIL_PORT || '465', 10);
  const user = process.env.EMAIL_USER || '';
  const pass = process.env.EMAIL_PASS || '';
  const secure = process.env.EMAIL_SECURE === 'true';

  console.log('Email config:', { host, port, user, secure });

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: true, // Включаем логирование
    debug: true, // Включаем режим отладки
    tls: {
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

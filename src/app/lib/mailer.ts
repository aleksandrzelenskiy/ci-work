// lib/mailer.ts
import nodemailer from 'nodemailer';

interface Task {
  _id: string;
  task: string;
  userName: string;
  createdAt: Date;
}

/**
 * Функция для отправки письма при изменении статуса задачи
 * @param task - Объект задачи
 * @param oldStatus - Старый статус
 * @param newStatus - Новый статус
 * @param recipientEmail - Email получателя
 */
export const sendStatusChangeEmail = async (
  task: Task,
  oldStatus: string,
  newStatus: string,
  recipientEmail: string
): Promise<void> => {
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: recipientEmail,
    subject: `Статус фотоотчета "${task.task}" изменен`,
    text: `
Здравствуйте!

Статус фотоотчета "${task.task}" был изменен с "${oldStatus}" на "${newStatus}".

Детали задачи:
- ID: ${task._id}
- Название: ${task.task}
- Автор: ${task.userName}
- Дата создания: ${new Date(task.createdAt).toLocaleString()}

С уважением,
Ваша команда
    `,
    //
    // html: `<p>...</p>`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Письмо успешно отправлено');
  } catch (error) {
    console.error('Ошибка при отправке письма:', error);
  }
};

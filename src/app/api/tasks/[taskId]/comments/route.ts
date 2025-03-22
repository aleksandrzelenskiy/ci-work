// app/api/tasks/[taskId]/comments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import UserModel from '@/app/models/UserModel';
import { currentUser } from '@clerk/nextjs/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import { sendEmail } from '@/utils/mailer'; // Импорт функции отправки письма

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params: { taskId } }: { params: { taskId: string } }
) {
  try {
    await dbConnect();

    // Проверяем наличие taskId
    if (!taskId) {
      return NextResponse.json(
        { error: 'No taskId provided' },
        { status: 400 }
      );
    }

    // Проверка аутентификации
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Получаем данные пользователя из БД (например, аватар)
    const dbUser = await UserModel.findOne({ clerkUserId: user.id });
    const profilePic = dbUser?.profilePic || '';

    const contentType = request.headers.get('content-type');
    let commentText = '';
    let file: File | null = null;

    if (contentType?.includes('application/json')) {
      const body = await request.json();
      commentText = body.text;
    } else if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      commentText = formData.get('text')?.toString() || '';
      const fileData = formData.get('photo');
      if (fileData && fileData instanceof File) {
        file = fileData;
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported content type' },
        { status: 400 }
      );
    }

    if (!commentText) {
      return NextResponse.json(
        { error: 'Comment text is required' },
        { status: 400 }
      );
    }

    // Обработка файла (если прикреплено фото)
    let photoUrl: string | undefined;
    if (file) {
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'comments');
      await fs.mkdir(uploadDir, { recursive: true });
      const filename = `${uuidv4()}-${file.name}`;
      const filePath = join(uploadDir, filename);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);
      photoUrl = `/uploads/comments/${filename}`;
    }

    // Формируем новый комментарий
    const newComment = {
      _id: uuidv4(),
      text: commentText,
      author: `${user.firstName} ${user.lastName}`.trim() || 'Unknown',
      authorId: user.id,
      profilePic,
      createdAt: new Date(),
      photoUrl,
    };

    // Создаём событие для комментария
    const commentEvent = {
      action: 'COMMENT_ADDED',
      author: `${user.firstName} ${user.lastName}`.trim() || 'Unknown',
      authorId: user.id,
      date: new Date(),
      details: {
        comment: commentText,
        commentId: newComment._id,
      },
    };

    // Обновляем задачу: добавляем новый комментарий и событие
    const updatedTask = await TaskModel.findOneAndUpdate(
      { taskId: taskId.toUpperCase() },
      { $push: { comments: newComment, events: commentEvent } },
      { new: true }
    );

    if (!updatedTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Отправляем уведомления по почте всем участникам задачи
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'https://ciwork.pro';
      const taskLink = `${frontendUrl}/tasks/${updatedTask.taskId}`;
      const recipients = new Set(
        [
          updatedTask.authorEmail,
          updatedTask.initiatorEmail,
          updatedTask.executorEmail,
        ].filter((email) => email && email.trim())
      );
      const authorName = `${user.firstName} ${user.lastName}`.trim();
      const emailContent = {
        subject: `Новый комментарий в задаче ${updatedTask.taskId}`,
        text: `Автор: ${authorName}\nКомментарий: ${commentText}\nСсылка: ${taskLink}`,
        html: `
          <p>Автор: <strong>${authorName}</strong></p>
          <p>Комментарий: ${commentText}</p>
          <p><a href="${taskLink}">Перейти к задаче</a></p>
        `,
      };

      for (const email of recipients) {
        try {
          await sendEmail({
            to: email,
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html,
          });
          console.log(`Уведомление отправлено на ${email}`);
        } catch (emailError) {
          console.error(`Ошибка отправки на ${email}:`, emailError);
        }
      }
    } catch (error) {
      console.error('Ошибка при отправке уведомлений:', error);
    }

    return NextResponse.json({ comment: newComment, task: updatedTask });
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

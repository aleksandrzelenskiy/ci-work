// app/api/tasks/[taskId]/comments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import UserModel from '@/app/models/UserModel';
import { currentUser } from '@clerk/nextjs/server';
import { v4 as uuidv4 } from 'uuid';
import { sendEmail } from '@/utils/mailer';
import { uploadTaskFile } from '@/utils/s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await context.params; // дождаться параметров

  try {
    await dbConnect();

    if (!taskId) {
      return NextResponse.json({ error: 'No taskId provided' }, { status: 400 });
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // данные пользователя (аватар)
    const dbUser = await UserModel.findOne({ clerkUserId: user.id });
    const profilePic = dbUser?.profilePic || '';

    const contentType = request.headers.get('content-type') || '';
    let commentText = '';
    let file: File | null = null;

    if (contentType.includes('application/json')) {
      const body = await request.json();
      commentText = (body?.text ?? '').toString();
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      commentText = formData.get('text')?.toString() || '';
      const photo = formData.get('photo');
      if (photo instanceof File) file = photo;
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 400 });
    }

    if (!commentText.trim()) {
      return NextResponse.json({ error: 'Comment text is required' }, { status: 400 });
    }

    // ===== Загрузка фото комментария (если есть) =====
    let photoUrl: string | undefined;
    if (file) {
      const mime = file.type || 'application/octet-stream';

      // базовая валидация без any
      const allowed: ReadonlyArray<string> = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'application/pdf',
      ];
      const okType = allowed.includes(mime) || mime.startsWith('image/');
      if (!okType) {
        return NextResponse.json(
            { error: 'Unsupported file type for comment photo' },
            { status: 400 }
        );
      }

      if (file.size > 20 * 1024 * 1024) {
        return NextResponse.json(
            { error: 'Comment photo too large (max 20 MB)' },
            { status: 413 }
        );
      }

      const taskIdUpper = taskId.toUpperCase();
      const buffer = Buffer.from(await file.arrayBuffer());
      // сохраняем по принципу uploads/<taskId>/<taskId>-comments/<filename>
      photoUrl = await uploadTaskFile(
          buffer,
          taskIdUpper,
          'comments',
          `${Date.now()}-${file.name}`,
          mime
      );
    }

    // ===== Формируем комментарий и событие =====
    const authorName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'Unknown';

    const newComment = {
      _id: uuidv4(),
      text: commentText,
      author: authorName,
      authorId: user.id,
      profilePic,
      createdAt: new Date(),
      photoUrl,
    };

    const commentEvent = {
      action: 'COMMENT_ADDED',
      author: authorName,
      authorId: user.id,
      date: new Date(),
      details: {
        comment: commentText,
        commentId: newComment._id,
      },
    };

    // ===== Обновляем задачу =====
    const updatedTask = await TaskModel.findOneAndUpdate(
        { taskId: taskId.toUpperCase() },
        { $push: { comments: newComment, events: commentEvent } },
        { new: true }
    );

    if (!updatedTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // ===== Уведомления по почте (без падения роута при сбое почты) =====
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'https://ciwork.ru';
      const taskLink = `${frontendUrl}/tasks/${updatedTask.taskId}`;
      const recipients = new Set<string>(
          [
            updatedTask.authorEmail,
            // updatedTask.initiatorEmail,
            updatedTask.executorEmail,
            // 'transport@t2.ru',
          ].filter((e): e is string => Boolean(e && e.trim()))
      );

      const subject = `Новый комментарий в задаче "${updatedTask.taskName} ${updatedTask.bsNumber}" (${updatedTask.taskId})`;
      const text = `Автор: ${authorName}\nКомментарий: ${commentText}\nСсылка: ${taskLink}`;
      const html = `
        <p>Автор: <strong>${authorName}</strong></p>
        <p>Комментарий: ${commentText}</p>
        <p><a href="${taskLink}">Перейти к задаче</a></p>
      `;

      for (const to of recipients) {
        try {
          await sendEmail({ to, subject, text, html });
          console.log(`Уведомление отправлено на ${to}`);
        } catch (emailErr) {
          console.error(`Ошибка отправки на ${to}:`, emailErr);
        }
      }
    } catch (notifyErr) {
      console.error('Ошибка при отправке уведомлений:', notifyErr);
    }

    return NextResponse.json({ comment: newComment, task: updatedTask });
  } catch (err) {
    console.error('Error adding comment:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

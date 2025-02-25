import { NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';

interface Location {
  coordinates: [number, number];
}

export async function GET() {
  try {
    await dbConnect();
    console.log('Connected to MongoDB');
  } catch (error: unknown) {
    console.error('Failed to connect to MongoDB:', error);
    return NextResponse.json(
      { error: 'Failed to connect to database' },
      { status: 500 }
    );
  }

  try {
    const userResponse = await GetCurrentUserFromMongoDB();

    if (!userResponse.success || !userResponse.data) {
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    const user = userResponse.data;
    const clerkUserId = user.clerkUserId;
    const role = user.role;

    let filter = {};

    // В зависимости от роли пользователя добавляем соответствующий фильтр
    if (role === 'executor') {
      filter = { executorId: clerkUserId };
    } else if (role === 'initiator') {
      filter = { initiatorId: clerkUserId };
    } else if (role === 'author') {
      filter = { authorId: clerkUserId };
    }

    const tasks = await TaskModel.aggregate([
      {
        $match: filter, // Применяем фильтр
      },
      {
        $addFields: {
          bsNumbers: {
            $split: ['$bsNumber', '-'],
          },
        },
      },
      {
        $lookup: {
          from: 'objects-t2-ir',
          let: { bsNumbers: '$bsNumbers' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ['$name', '$$bsNumbers'],
                },
              },
            },
          ],
          as: 'objectDetails',
        },
      },
      {
        $sort: { createdAt: -1 },
      },
    ]);

    // Фильтруем задачи, чтобы оставить только те, у которых есть координаты
    const filteredTasks = tasks.filter((task) =>
      task.bsLocation.some((location: Location) => location.coordinates)
    );

    return NextResponse.json({ tasks: filteredTasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

// app/api/tasks/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/utils/mongoose';
import TaskModel from '@/app/models/TaskModel';

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
    const tasks = await TaskModel.aggregate([
      {
        $lookup: {
          from: 'objects-t2-ir', // Название коллекции objects-t2-ir
          localField: 'bsNumber', // Поле в коллекции tasks, которое соответствует name в objects-t2-ir
          foreignField: 'name', // Поле в коллекции objects-t2-ir
          as: 'objectDetails', // Название нового поля, в которое будут добавлены данные из objects-t2-ir
        },
      },
      {
        $unwind: {
          path: '$objectDetails',
          preserveNullAndEmptyArrays: true, // Если совпадений нет, объект все равно будет возвращен
        },
      },
      {
        $sort: { createdAt: -1 },
      },
    ]);

    return NextResponse.json({ tasks });
  } catch (error: unknown) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

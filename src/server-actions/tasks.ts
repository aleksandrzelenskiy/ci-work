'use server';

import { Task } from '@/app/types/taskTypes';
import TaskModel from '@/app/models/TaskModel';
import dbConnect from '@/utils/mongoose';

export const createTask = async (taskData: Omit<Task, 'createdAt'>) => {
  await dbConnect();

  try {
    const newTask = new TaskModel({
      ...taskData,
      createdAt: new Date(),
    });

    await newTask.save();
    return { success: true, task: newTask.toObject() };
  } catch (error) {
    console.error('Error creating task:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

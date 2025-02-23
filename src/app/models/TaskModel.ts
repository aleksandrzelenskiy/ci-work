// app/models/TaskModel.ts

import { Schema, Document, model, models } from 'mongoose';
import { Task, PriorityLevel, CurrentStatus } from '../types/taskTypes';

const TaskSchema = new Schema<Task & Document>({
  taskId: { type: String, required: true },
  taskName: { type: String, required: true },
  bsNumber: { type: String, required: true },
  bsLocation: [
    {
      name: String,
      coordinates: String,
    },
  ],
  bsAddress: { type: String, required: true },
  totalCost: { type: Number, required: true },
  workItems: [
    {
      workType: String,
      quantity: Number,
      unit: String,
      note: String,
    },
  ],
  taskDescription: { type: String },
  authorId: { type: String },
  authorName: { type: String },
  authorEmail: { type: String },
  initiatorId: { type: String },
  initiatorName: { type: String },
  initiatorEmail: { type: String },
  executorId: { type: String, required: false },
  executorName: { type: String, required: false },
  executorEmail: { type: String, required: false },
  dueDate: { type: Date, required: false },
  priority: {
    type: String,
    enum: ['urgent', 'high', 'medium', 'low'] as PriorityLevel[],
    default: 'medium',
    required: true,
  },
  status: {
    type: String,
    enum: [
      'To do',
      'Assigned',
      'At work',
      'Done',
      'Pending',
      'Issues',
      'Fixed',
      'Agreed',
    ] as CurrentStatus[],
    default: 'To do',
  },
  attachments: [
    {
      type: String,
      required: false,
    },
  ],
  createdAt: { type: Date, default: Date.now },
  orderUrl: { type: String, required: true },
  events: [
    {
      action: { type: String, required: true }, // Тип действия (например, "STATUS_CHANGED", "TASK_UPDATED")
      author: { type: String, required: true }, // Имя автора изменения
      authorId: { type: String, required: true }, // ID автора изменения
      date: { type: Date, default: Date.now }, // Дата изменения
      details: { type: Schema.Types.Mixed }, // Детали изменения (например, старый и новый статус)
    },
  ],
});

export default models.Task || model<Task & Document>('Task', TaskSchema);

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
  executorId: { type: String },
  executorName: { type: String },
  executorEmail: { type: String },
  dueDate: { type: Date },
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

  // Тип задачи (строительная или документальная)
  taskType: {
    type: String,
    enum: ['construction', 'installation', 'document'],
    required: true,
    default: 'construction',
  },

  // Какие вложения обязательны (например: ['photo'] или ['pdf','dwg'])
  requiredAttachments: [
    {
      type: String,
      enum: ['photo', 'pdf', 'doc', 'xlsm', 'xlsx', 'dwg'],
    },
  ],

  // Ссылки на связанные задачи (для зависимостей и макро-задач)
  relatedTasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],

  // Вложения (фото или файлы)
  attachments: [
    {
      type: String,
      required: false,
    },
  ],

  // Поля согласования
  approvedBy: { type: String }, // ID или имя инициатора, согласовавшего задачу
  approvedAt: { type: Date },

  createdAt: { type: Date, default: Date.now },
  orderUrl: { type: String, required: true },
  orderNumber: { type: String },
  orderDate: { type: Date },
  orderSignDate: { type: Date },
  closingDocumentsUrl: { type: String },

  // История событий
  events: [
    {
      action: { type: String, required: true }, // Тип действия
      author: { type: String, required: true }, // Имя автора изменения
      authorId: { type: String, required: true }, // ID автора изменения
      date: { type: Date, default: Date.now }, // Дата изменения
      details: { type: Schema.Types.Mixed }, // Детали изменения
    },
  ],

  // Комментарии
  comments: [
    {
      _id: { type: String, required: true },
      text: { type: String, required: true },
      author: { type: String, required: true },
      authorId: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
      photoUrl: { type: String },
      profilePic: { type: String },
    },
  ],
});

export default models.Task || model<Task & Document>('Task', TaskSchema);

// app/models/TaskModel.ts

import { Schema, Document, model, models } from 'mongoose';
import { Task, PriorityLevel, CurrentStatus } from '../types/taskTypes';

const TaskSchema = new Schema<Task & Document>({
  taskId: { type: String, required: true },
  taskName: { type: String, required: true },
  bsNumber: { type: String, required: true },
  bsAddress: { type: String, required: true },
  coordinates: {
    lat: Number,
    lng: Number,
  },
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
  author: { type: String },
  initiator: { type: String },
  initiatorId: { type: String },
  executor: String,
  executorId: String,
  dueDate: { type: Date, required: true },
  priority: {
    type: String,
    enum: ['urgent', 'high', 'medium', 'low'] as PriorityLevel[],
    default: 'medium',
    required: true,
  },
  status: {
    type: String,
    enum: ['to do', 'assigned', 'at work', 'done', 'agreed'] as CurrentStatus[],
    default: 'to do',
  },
  attachments: [
    {
      type: String,
      required: false,
    },
  ],
  createdAt: { type: Date, default: Date.now },
  orderUrl: { type: String, required: true },
});

export default models.Task || model<Task & Document>('Task', TaskSchema);

// app/models/TaskModel.ts

import { Schema, Document, model, models } from 'mongoose';
import { Task, PriorityLevel, CurrentStatus } from '../types/taskTypes';

const WorkItemSchema = new Schema({
  id: { type: String, required: true },
  workType: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  note: { type: String },
});

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
  workItems: [WorkItemSchema],
  taskDescription: { type: String },
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
  authorEmail: { type: String, required: true },
  initiatorId: { type: String, required: true },
  initiatorName: { type: String, required: true },
  initiatorEmail: { type: String, required: true },
  executorId: { type: String, required: true },
  executorName: { type: String, required: true },
  executorEmail: { type: String, required: true },
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
  attachments: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
  orderUrl: { type: String },
});

export default models.Task || model<Task & Document>('Task', TaskSchema);

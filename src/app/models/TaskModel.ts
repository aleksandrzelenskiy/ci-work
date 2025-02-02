import { Schema, Document, model, models } from 'mongoose';
import { Task, PriorityLevel } from '../types/taskTypes';

const TaskSchema = new Schema<Task & Document>({
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
  executor: String,
  taskDescription: { type: String },
  author: { type: String },
  initiator: { type: String },
  dueDate: { type: Date, required: true },
  priority: {
    type: String,
    enum: ['urgent', 'high', 'medium', 'low'] as PriorityLevel[],
    default: 'medium',
    required: true,
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

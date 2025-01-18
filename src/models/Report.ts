// /app/models/Report.ts

import mongoose, { Schema } from 'mongoose';
import { IReport, IEvent } from '../app/types/reportTypes';

// Schema for a single history event (Event).

const EventSchema = new Schema<IEvent>(
  {
    action: { type: String, required: true },
    author: { type: String, required: true },
    authorId: { type: String, required: true },
    date: { type: Date, default: Date.now },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

// Main report schema.

const ReportSchema: Schema<IReport> = new Schema({
  task: { type: String, required: true },
  baseId: { type: String, required: true },
  files: { type: [String], default: [] },
  fixedFiles: { type: [String], default: [] },
  issues: { type: [String], default: [] },
  status: { type: String, default: 'Pending' },
  createdAt: { type: Date, default: Date.now },
  userId: { type: String, required: true },
  userName: { type: String, default: 'Unknown' },

  events: { type: [EventSchema], default: [] },
});

// If the model already exists, use it; otherwise, create a new one.
export default mongoose.models.Report ||
  mongoose.model<IReport>('Report', ReportSchema);

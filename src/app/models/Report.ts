// app/models/Report.ts
import mongoose, { Schema, Document } from 'mongoose';

interface IReport extends Document {
  task: string;
  baseId: string;
  files: string[]; // Основные фотографии
  fixedFiles: string[]; // Фотографии устранения замечаний
  issues: string[];
  status: string;
  createdAt: Date;
  userName: string;
}

const ReportSchema: Schema = new Schema({
  task: { type: String, required: true },
  baseId: { type: String, required: true },
  files: { type: [String], default: [] },
  fixedFiles: { type: [String], default: [] }, // Добавлено поле fixedFiles
  issues: { type: [String], default: [] },
  status: { type: String, default: 'Pending' },
  createdAt: { type: Date, default: Date.now },
  userName: { type: String, default: 'Unknown' },
});

export default mongoose.models.Report ||
  mongoose.model<IReport>('Report', ReportSchema);

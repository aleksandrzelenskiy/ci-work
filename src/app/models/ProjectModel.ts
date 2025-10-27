// src/app/models/ProjectModel.ts
import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface Project extends Document {
    orgId: mongoose.Types.ObjectId;
    name: string;
    key: string;
    description?: string;
    managers: string[]; // emails менеджеров
    createdByEmail: string;
    createdAt: Date;
}

const ProjectSchema = new Schema<Project>(
    {
        orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
        name: { type: String, required: true },
        key: { type: String, required: true },
        description: { type: String },
        managers: [{ type: String, default: [] }],
        createdByEmail: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

ProjectSchema.index({ orgId: 1, key: 1 }, { unique: true });

export default (models.Project as mongoose.Model<Project>) ||
model<Project>('Project', ProjectSchema);

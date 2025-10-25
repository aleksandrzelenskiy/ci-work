import { Schema, model, models, Document, Types } from 'mongoose';


export interface Project extends Document {
    orgId: Types.ObjectId; // ref Organization
    name: string;
    code?: string; // короткий код проекта (для ссылок/экспорта)
    description?: string;
}


const ProjectSchema = new Schema<Project>({
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true },
    code: String,
    description: String,
}, { timestamps: true });


ProjectSchema.index({ orgId: 1, name: 1 }, { unique: true });


export default models.Project || model<Project>('Project', ProjectSchema);
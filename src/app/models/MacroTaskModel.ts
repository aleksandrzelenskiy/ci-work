import { Schema, Document, model, models } from 'mongoose';
import { MacroTask } from '../types/macroTaskTypes';

const MacroTaskSchema = new Schema<MacroTask & Document>({
    macroTaskId: { type: String, required: true },
    macroTaskName: { type: String, required: true },
    description: { type: String },

    initiatorId: { type: String, required: true },
    initiatorName: { type: String, required: true },
    initiatorEmail: { type: String, required: true },

    curatorId: { type: String },
    curatorName: { type: String },
    curatorEmail: { type: String },

    bsNumber: { type: String, required: true },
    bsAddress: { type: String, required: true },
    bsLocation: {
        name: { type: String },
        coordinates: { type: String },
    },

    dueDate: { type: Date },
    priority: {
        type: String,
        enum: ['urgent', 'high', 'medium', 'low'],
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
        ],
        default: 'To do',
    },

    createdAt: { type: Date, default: Date.now },

    tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }],

    workflow: [
        {
            order: { type: Number, required: true },
            task: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
            dependsOn: { type: Schema.Types.ObjectId, ref: 'Task' },
        },
    ],

    approvedBy: { type: String },
    approvedAt: { type: Date },

    events: [
        {
            action: { type: String, required: true },
            author: { type: String, required: true },
            authorId: { type: String, required: true },
            date: { type: Date, default: Date.now },
            details: { type: Schema.Types.Mixed },
        },
    ],

    comments: [
        {
            text: { type: String, required: true },
            author: { type: String, required: true },
            authorId: { type: String, required: true },
            createdAt: { type: Date, default: Date.now },
            profilePic: { type: String },
        },
    ],
});

export default models.MacroTask ||
model<MacroTask & Document>('MacroTask', MacroTaskSchema);

import { Schema, model, models, Document, } from 'mongoose';


export interface Organization extends Document {
    name: string;
    slug: string; // человекочитаемый идентификатор в URL
    ownerId: string; // Clerk userId владельца
    billing?: {
        stripeCustomerId?: string;
        plan: 'free' | 'pro' | 'enterprise';
        seatLimit?: number; // лимит мест (персидов)
    };
}


const OrganizationSchema = new Schema<Organization>({
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true },
    billing: {
        stripeCustomerId: String,
        plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
        seatLimit: Number,
    },
}, { timestamps: true });


export default models.Organization || model<Organization>('Organization', OrganizationSchema);
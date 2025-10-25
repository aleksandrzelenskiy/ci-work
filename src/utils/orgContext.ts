import Organization from '@/app/models/OrganizationModel';
import dbConnect from '@/utils/mongoose';
import { auth } from '@clerk/nextjs/server';

export async function getOrgBySlugOrThrow(req: Request) {
    await dbConnect();
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');
    const slug = req.headers.get('x-org-slug') || new URL(req.url).searchParams.get('org');
    if (!slug) throw new Error('Organization slug required');
    const org = await Organization.findOne({ slug });
    if (!org) throw new Error('Organization not found');
    return { org, userId };
}

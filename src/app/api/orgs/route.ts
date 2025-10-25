//app/api/orgs/route.ts

import { auth } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import Organization from '@/app/models/OrganizationModel';
import slugify from 'slugify';

export async function GET() {
    await dbConnect();
    const { userId } = await auth();
    const orgs = await Organization.find({ ownerId: userId! }).sort({ createdAt: -1 });
    return Response.json({ orgs });
}

export async function POST(req: Request) {
    await dbConnect();
    const { userId } = await auth();
    const { name } = await req.json();
    const slug = slugify(name, { lower: true, strict: true });
    const org = await Organization.create({ name, slug, ownerId: userId! });
    return Response.json({ org }, { status: 201 });
}

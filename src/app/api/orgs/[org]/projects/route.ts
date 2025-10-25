// app/api/orgs/[org]/projects/route.ts

import dbConnect from '@/utils/mongoose';
import Project from '@/app/models/ProjectModel';
import { getOrgBySlugOrThrow } from '@/utils/orgContext';

export async function GET(req: Request) {
    await dbConnect();
    const { org } = await getOrgBySlugOrThrow(req);
    const projects = await Project.find({ orgId: org._id }).sort({ createdAt: -1 });
    return Response.json({ projects });
}

export async function POST(req: Request) {
    await dbConnect();
    const { org } = await getOrgBySlugOrThrow(req);
    const body = await req.json();
    const created = await Project.create({ ...body, orgId: org._id });
    return Response.json({ project: created }, { status: 201 });
}

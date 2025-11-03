//app/api/org/[org]/projects/_helpers.ts

import { Types } from 'mongoose';
import dbConnect from '@/utils/mongoose';
import Organization from '@/app/models/OrganizationModel';
import ProjectModel from '@/app/models/ProjectModel';

// Минимальные lean-типы
type OrgLean = {
    _id: Types.ObjectId;
    orgSlug: string;
};

type ProjectLean = {
    _id: Types.ObjectId;
    orgId: Types.ObjectId;
    key: string;
};

type Ok = { orgDoc: OrgLean; projectDoc: ProjectLean };
type Err = { error: string };

function isObjectIdLike(v: string): boolean {
    return /^[a-fA-F0-9]{24}$/.test(v);
}

export async function getOrgAndProjectByRef(
    orgRef: string,
    projectRef: string
): Promise<Ok | Err> {
    await dbConnect();

    // Организация по orgSlug ИЛИ _id
    const orgQuery = isObjectIdLike(orgRef)
        ? { _id: new Types.ObjectId(orgRef) }
        : { orgSlug: orgRef.trim().toLowerCase() };

    const orgDoc = await Organization.findOne(orgQuery).lean<OrgLean>();
    if (!orgDoc) return { error: 'Organization not found' };

    // Проект: по _id ИЛИ по key (key хранится UPPERCASE)
    const projectDoc = isObjectIdLike(projectRef)
        ? await ProjectModel.findOne({
            _id: new Types.ObjectId(projectRef),
            orgId: orgDoc._id,
        }).lean<ProjectLean>()
        : await ProjectModel.findOne({
            orgId: orgDoc._id,
            key: projectRef.trim().toUpperCase(),
        }).lean<ProjectLean>();

    if (!projectDoc) return { error: 'Project not found' };

    return { orgDoc, projectDoc };
}

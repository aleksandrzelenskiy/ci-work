// src/app/api/org/[org]/projects/[project]/_helpers.ts
import Organization from '@/app/models/OrganizationModel';
import Project from '@/app/models/ProjectModel';
import { Types } from 'mongoose';

export async function getOrgAndProjectByRef(orgSlug: string, projectRef: string) {
    // Ищем ОРГ только по orgSlug (нормализуем к lower)
    const normalized = orgSlug.trim().toLowerCase();
    const orgDoc = await Organization
        .findOne({ orgSlug: normalized })
        .select('_id orgSlug name')
        .lean();
    if (!orgDoc) return { error: 'Org not found' as const };

    // Проект — по _id или по KEY (KEY => UPPERCASE)
    const isId = Types.ObjectId.isValid(projectRef);
    const projQuery = isId
        ? { _id: projectRef, orgId: orgDoc._id }
        : { key: String(projectRef).trim().toUpperCase(), orgId: orgDoc._id };

    const projectDoc = await Project
        .findOne(projQuery)
        .select('_id name orgId key')
        .lean();

    if (!projectDoc) return { error: 'Project not found' as const };

    return { orgDoc, projectDoc };
}

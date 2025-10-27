// src/app/utils/permissions.ts
import dbConnect from '@/utils/mongoose';
import Organization from '@/app/models/OrganizationModel';
import Membership, { OrgRole } from '@/app/models/MembershipModel';

export async function requireOrgRole(
    orgSlug: string,
    userEmail: string,
    allowed: OrgRole[]
): Promise<{ org: typeof Organization.prototype; membership: typeof Membership.prototype }> {
    await dbConnect();

    const org = await Organization.findOne({ slug: orgSlug });
    if (!org) throw new Error('Организация не найдена');

    const membership = await Membership.findOne({ orgId: org._id, userEmail });
    if (!membership) throw new Error('Нет членства в этой организации');

    if (!allowed.includes(membership.role as OrgRole)) {
        throw new Error('Недостаточно прав');
    }

    return { org, membership };
}

export async function getOrgBySlug(orgSlug: string) {
    await dbConnect();
    const org = await Organization.findOne({ slug: orgSlug });
    if (!org) throw new Error('Организация не найдена');
    return org;
}

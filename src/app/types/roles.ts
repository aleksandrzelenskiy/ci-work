// src/app/types/roles.ts

export type PlatformRole = 'super_admin' | 'staff' | 'user';
export type OrgRole = 'owner' | 'org_admin' | 'manager' | 'executor' | 'viewer';
export type EffectiveOrgRole = OrgRole | 'super_admin';

export const ADMIN_ROLES: EffectiveOrgRole[] = ['super_admin', 'owner', 'org_admin'];
export const MANAGER_ROLES: EffectiveOrgRole[] = [...ADMIN_ROLES, 'manager'];
export const LIMITED_ROLES: EffectiveOrgRole[] = ['executor', 'viewer'];

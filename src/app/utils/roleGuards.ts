// src/app/utils/roleGuards.ts

import type { EffectiveOrgRole } from '@/app/types/roles';

const ADMIN_ROLES: EffectiveOrgRole[] = ['super_admin', 'owner', 'org_admin'];
const MANAGER_ROLES: EffectiveOrgRole[] = [...ADMIN_ROLES, 'manager'];

export const isAdminRole = (role?: EffectiveOrgRole | null): boolean =>
  role ? ADMIN_ROLES.includes(role) : false;

export const isManagerRole = (role?: EffectiveOrgRole | null): boolean =>
  role ? MANAGER_ROLES.includes(role) : false;

export const isExecutorRole = (role?: EffectiveOrgRole | null): boolean =>
  role === 'executor';

export const isViewerRole = (role?: EffectiveOrgRole | null): boolean =>
  role === 'viewer';

export const canEditTasks = (role?: EffectiveOrgRole | null): boolean =>
  isAdminRole(role) || role === 'manager';

export const canViewCalendar = (role?: EffectiveOrgRole | null): boolean =>
  !isExecutorRole(role);

export const canManageFiles = (role?: EffectiveOrgRole | null): boolean =>
  isAdminRole(role);

// src/utils/roleMapping.ts

import type { EffectiveOrgRole } from '@/app/types/roles';

/**
 * Temporary helper to map new organization roles to the legacy strings
 * that some components (reports UI) still expect. Remove once reports
 * migrate to EffectiveOrgRole entirely.
 */
export const mapRoleToLegacy = (
  role?: EffectiveOrgRole | null
): 'admin' | 'manager' | 'executor' | 'viewer' | null => {
  if (!role) return null;
  if (role === 'super_admin' || role === 'owner' || role === 'org_admin') {
    return 'admin';
  }
  if (role === 'manager') {
    return 'manager';
  }
  if (role === 'executor') {
    return 'executor';
  }
  if (role === 'viewer') {
    return 'viewer';
  }
  return null;
};

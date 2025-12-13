// src/utils/publicTasks.ts
import { type ClientSession, Types } from 'mongoose';
import { consumeUsageSlot, getUsageSnapshot, loadPlanForOrg } from '@/utils/billingLimits';

export type OrgId = Types.ObjectId | string;

export interface PublicTaskLimitResult {
  ok: boolean;
  limit: number;
  used: number;
  reason?: string;
}

/**
 * Проверяет или бронирует слот публикации публичной задачи за текущий календарный месяц.
 */
export async function ensurePublicTaskSlot(
  orgId: OrgId,
  options?: { consume?: boolean; session?: ClientSession }
): Promise<PublicTaskLimitResult> {
  if (options?.consume) {
    const consumed = await consumeUsageSlot(orgId, 'publications', {
      session: options.session,
    });

    const limitNumber =
      typeof consumed.limit === 'number' ? consumed.limit : Number.POSITIVE_INFINITY;
    return {
      ok: consumed.ok,
      limit: limitNumber,
      used: consumed.used,
      reason:
        consumed.reason ||
        `Лимит публикаций на месяц исчерпан: ${consumed.used}/${Number.isFinite(limitNumber) ? limitNumber : '∞'}`,
    };
  }

  const [{ limits }, usage] = await Promise.all([
    loadPlanForOrg(orgId),
    getUsageSnapshot(orgId),
  ]);

  const limit = typeof limits.publications === 'number' ? limits.publications : Number.POSITIVE_INFINITY;
  const used = usage?.publicationsUsed ?? 0;

  if (used >= limit) {
    return {
      ok: false,
      limit,
      used,
      reason: `Лимит публикаций на месяц исчерпан: ${used}/${Number.isFinite(limit) ? limit : '∞'}`,
    };
  }

  return { ok: true, limit, used };
}

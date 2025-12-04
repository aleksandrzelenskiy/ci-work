// src/utils/publicTasks.ts
import { Types } from 'mongoose';
import Subscription from '@/app/models/SubscriptionModel';
import TaskModel from '@/app/models/TaskModel';

export type OrgId = Types.ObjectId | string;

export interface PublicTaskLimitResult {
  ok: boolean;
  limit: number;
  used: number;
  reason?: string;
}

/**
 * Проверяет, можно ли опубликовать новую публичную задачу
 * исходя из лимита подписки.
 */
export async function ensurePublicTaskSlot(orgId: OrgId): Promise<PublicTaskLimitResult> {
  const sub = await Subscription.findOne({ orgId }).lean();
  const limit = sub?.publicTasksLimit ?? 2;
  const used = await TaskModel.countDocuments({
    orgId,
    visibility: 'public',
    publicStatus: { $in: ['open', 'in_review', 'assigned'] },
  });

  if (used >= limit) {
    return {
      ok: false,
      limit,
      used,
      reason: 'Достигнут лимит публичных задач по текущему тарифу',
    };
  }

  return { ok: true, limit, used };
}

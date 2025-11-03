// src/app/utils/seats.ts
import { Types } from 'mongoose';
import Subscription from '@/app/models/SubscriptionModel';
import Membership from '@/app/models/MembershipModel';

export type OrgId = Types.ObjectId | string;

export type SeatCheckResult = {
    ok: boolean;
    limit: number;
    used: number;
};

/**
 * Проверяет, можно ли активировать ещё одного участника.
 * Основано на подписке org: seats vs активные участники.
 */
export async function ensureSeatAvailable(orgId: OrgId): Promise<SeatCheckResult> {
    const sub = await Subscription.findOne({ orgId }).lean();

    // Если подписки нет / неактивна / seats не задан — используем дефолт 10
    if (!sub || !sub.seats || sub.status === 'inactive') {
        const used = await Membership.countDocuments({ orgId, status: 'active' });
        const limit = sub?.seats ?? 10;
        return { ok: used < limit, limit, used };
    }

    const limit = sub.seats;
    const used = await Membership.countDocuments({ orgId, status: 'active' });
    return { ok: used < limit, limit, used };
}

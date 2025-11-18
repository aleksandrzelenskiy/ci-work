// src/app/utils/notificationService.ts

import { Types } from 'mongoose';
import NotificationModel, { type NotificationDoc } from '@/app/models/NotificationModel';
import type {
    NotificationDTO,
    NotificationKind,
    NotificationStatus,
} from '@/app/types/notifications';

type ObjectIdLike = Types.ObjectId | string;

const toObjectId = (value: ObjectIdLike): Types.ObjectId => {
    if (value instanceof Types.ObjectId) {
        return value;
    }
    return new Types.ObjectId(value);
};

export interface CreateNotificationParams {
    recipientUserId: ObjectIdLike;
    type: NotificationKind;
    title: string;
    message: string;
    link?: string;
    status?: NotificationStatus;
    orgId?: ObjectIdLike;
    orgSlug?: string;
    orgName?: string;
    senderName?: string;
    senderEmail?: string;
    metadata?: Record<string, unknown>;
}

type NotificationLeanDoc = Pick<
    NotificationDoc,
    | '_id'
    | 'type'
    | 'title'
    | 'message'
    | 'link'
    | 'createdAt'
    | 'status'
    | 'orgId'
    | 'orgSlug'
    | 'orgName'
    | 'senderName'
    | 'senderEmail'
    | 'metadata'
>;

export const mapNotificationToDTO = (doc: NotificationLeanDoc): NotificationDTO => ({
    id: doc._id.toString(),
    type: doc.type,
    title: doc.title,
    message: doc.message,
    link: doc.link,
    createdAt: doc.createdAt?.toISOString?.() ?? new Date().toISOString(),
    status: doc.status,
    orgId: doc.orgId ? doc.orgId.toString() : undefined,
    orgSlug: doc.orgSlug,
    orgName: doc.orgName,
    senderName: doc.senderName,
    senderEmail: doc.senderEmail,
    metadata: doc.metadata ?? undefined,
});

export async function createNotification({
    recipientUserId,
    type,
    title,
    message,
    link,
    status,
    orgId,
    orgSlug,
    orgName,
    senderName,
    senderEmail,
    metadata,
}: CreateNotificationParams) {
    return NotificationModel.create({
        recipientUserId: toObjectId(recipientUserId),
        type,
        title,
        message,
        link,
        status: status ?? 'unread',
        orgId: orgId ? toObjectId(orgId) : undefined,
        orgSlug,
        orgName,
        senderName,
        senderEmail,
        metadata,
    });
}

export async function fetchNotificationsForUser(
    recipientUserId: ObjectIdLike,
    limit = 20,
    skip = 0
): Promise<NotificationDTO[]> {
    const docs = (await NotificationModel.find({
        recipientUserId: toObjectId(recipientUserId),
    })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()) as NotificationLeanDoc[];

    return docs.map((doc) => mapNotificationToDTO(doc));
}

export async function countUnreadNotifications(recipientUserId: ObjectIdLike) {
    return NotificationModel.countDocuments({
        recipientUserId: toObjectId(recipientUserId),
        status: 'unread',
    });
}

export async function countNotificationsForUser(recipientUserId: ObjectIdLike) {
    return NotificationModel.countDocuments({
        recipientUserId: toObjectId(recipientUserId),
    });
}

export async function markNotificationsAsRead(
    recipientUserId: ObjectIdLike,
    notificationIds?: string[]
) {
    const filter: Record<string, unknown> = {
        recipientUserId: toObjectId(recipientUserId),
        status: 'unread',
    };

    if (notificationIds && notificationIds.length > 0) {
        filter._id = {
            $in: notificationIds.map((id) => new Types.ObjectId(id)),
        };
    }

    const res = await NotificationModel.updateMany(filter, {
        $set: { status: 'read', readAt: new Date() },
    });

    return res.modifiedCount;
}

export async function deleteNotifications(
    recipientUserId: ObjectIdLike,
    notificationIds?: string[]
) {
    const filter: Record<string, unknown> = {
        recipientUserId: toObjectId(recipientUserId),
    };

    if (notificationIds && notificationIds.length > 0) {
        filter._id = {
            $in: notificationIds.map((id) => new Types.ObjectId(id)),
        };
    }

    const res = await NotificationModel.deleteMany(filter);
    return res.deletedCount;
}

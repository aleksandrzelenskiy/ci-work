// src/app/types/notifications.ts

export type NotificationKind =
    | 'org_invite'
    | 'invite_accepted'
    | 'invite_declined'
    | 'task_assigned';

export type NotificationStatus = 'unread' | 'read';

export interface NotificationDTO {
    id: string;
    type: NotificationKind;
    title: string;
    message: string;
    link?: string;
    createdAt: string;
    status: NotificationStatus;
    orgId?: string;
    orgSlug?: string;
    orgName?: string;
    senderName?: string;
    senderEmail?: string;
    metadata?: Record<string, unknown>;
}

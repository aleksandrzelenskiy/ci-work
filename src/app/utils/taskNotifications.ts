// src/app/utils/taskNotifications.ts

import { Types } from 'mongoose';
import UserModel from '@/app/models/UserModel';
import { createNotification } from '@/app/utils/notificationService';

export interface TaskAssignmentNotificationInput {
    executorClerkId?: string | null;
    taskId?: string;
    taskMongoId?: Types.ObjectId | string | null;
    taskName: string;
    bsNumber?: string;
    orgId?: Types.ObjectId | string | null;
    orgSlug?: string;
    orgName?: string;
    projectRef?: string;
    projectKey?: string;
    projectName?: string;
    triggeredByName?: string;
    triggeredByEmail?: string;
    link?: string;
    title?: string;
    message?: string;
}

export async function notifyTaskAssignment(input: TaskAssignmentNotificationInput) {
    if (!input.executorClerkId) {
        return;
    }

    const executor = await UserModel.findOne({ clerkUserId: input.executorClerkId })
        .select('_id name email')
        .lean();

    if (!executor?._id) {
        console.warn('notifyTaskAssignment: executor not found', input.executorClerkId);
        return;
    }

    let link = input.link;
    if (!link) {
        if (input.orgSlug && input.projectRef && input.taskMongoId) {
            link = `/org/${encodeURIComponent(input.orgSlug)}/projects/${encodeURIComponent(
                input.projectRef
            )}/tasks/${encodeURIComponent(String(input.taskMongoId))}`;
        } else if (input.taskId) {
            link = `/tasks/${encodeURIComponent(input.taskId.toLowerCase())}`;
        }
    }

    const bsInfo = input.bsNumber ? ` (БС ${input.bsNumber})` : '';
    const title = input.title ?? 'Вам назначена задача';
    const message =
        input.message ??
        `Вы назначены исполнителем по задаче «${input.taskName}»${bsInfo}.`;

    const metadataEntries = Object.entries({
        taskId: input.taskId,
        taskMongoId: input.taskMongoId ? String(input.taskMongoId) : undefined,
        bsNumber: input.bsNumber,
        projectRef: input.projectRef,
        projectKey: input.projectKey,
        projectName: input.projectName,
    }).filter(([, value]) => typeof value !== 'undefined' && value !== null);

    const metadata = metadataEntries.length > 0 ? Object.fromEntries(metadataEntries) : undefined;

    await createNotification({
        recipientUserId: executor._id,
        type: 'task_assigned',
        title,
        message,
        link,
        orgId: input.orgId ?? undefined,
        orgSlug: input.orgSlug ?? undefined,
        orgName: input.orgName ?? undefined,
        senderName: input.triggeredByName,
        senderEmail: input.triggeredByEmail,
        metadata,
    });
}

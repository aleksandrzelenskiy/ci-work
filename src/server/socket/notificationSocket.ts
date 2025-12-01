// src/server/socket/notificationSocket.ts

// src/server/socket/notificationSocket.ts

import { Server as SocketIOServer, type Socket } from 'socket.io';
import { NOTIFICATIONS_SOCKET_PATH } from '@/config/socket';
import type {
    NotificationDeletedEventPayload,
    NotificationNewEventPayload,
    NotificationReadEventPayload,
    NotificationServerToClientEvents,
    NotificationUnreadEventPayload,
} from '@/app/types/notifications';
import { verifySocketToken } from '@/server/socket/token';

const USER_ROOM_PREFIX = 'notification:user:';
const TASK_ROOM_PREFIX = 'task:';
const CHAT_ROOM_PREFIX = 'chat:conversation:';

type TaskCommentPayload = {
    _id: string;
    text: string;
    author: string;
    authorId: string;
    createdAt: string | Date;
    photoUrl?: string;
    profilePic?: string;
};

export class NotificationSocketGateway {
    private io?: SocketIOServer;
    private configured = false;

    public get path() {
        return NOTIFICATIONS_SOCKET_PATH;
    }

    public bindServer(io: SocketIOServer) {
        if (this.configured && this.io) {
            return this.io;
        }
        this.io = io;
        this.attachAuth(io);
        this.registerConnectionHandler(io);
        this.configured = true;
        return io;
    }

    private attachAuth(io: SocketIOServer) {
        io.use((socket, next) => {
            try {
                const tokenCandidate = socket.handshake.auth?.token ?? socket.handshake.headers?.token;
                if (typeof tokenCandidate !== 'string' || tokenCandidate.length === 0) {
                    next(new Error('UNAUTHORIZED'));
                    return;
                }
                const userId = verifySocketToken(tokenCandidate);
                if (!userId) {
                    next(new Error('UNAUTHORIZED'));
                    return;
                }
                socket.data.userId = userId;
                next();
            } catch (error) {
                console.error('[notifications socket] auth error', error);
                next(new Error('AUTH_FAILED'));
            }
        });
    }

    private registerConnectionHandler(io: SocketIOServer) {
        io.on('connection', (socket: Socket) => {
            const userId = socket.data?.userId;
            if (!userId) {
                socket.disconnect(true);
                return;
            }
            socket.join(this.roomName(userId));

            socket.on('task:join', ({ taskId }: { taskId?: string }) => {
                const normalized = this.taskRoomName(taskId);
                if (normalized) socket.join(normalized);
            });

            socket.on('task:leave', ({ taskId }: { taskId?: string }) => {
                const normalized = this.taskRoomName(taskId);
                if (normalized) socket.leave(normalized);
            });

            socket.on('chat:join', ({ conversationId }: { conversationId?: string }) => {
                const room = this.chatRoomName(conversationId);
                if (room) socket.join(room);
            });

            socket.on('chat:leave', ({ conversationId }: { conversationId?: string }) => {
                const room = this.chatRoomName(conversationId);
                if (room) socket.leave(room);
            });
        });
    }

    private roomName(userId: string) {
        return `${USER_ROOM_PREFIX}${userId}`;
    }

    private taskRoomName(taskIdInput?: unknown) {
        if (typeof taskIdInput !== 'string') return '';
        const cleaned = taskIdInput.trim();
        if (!cleaned) return '';
        return `${TASK_ROOM_PREFIX}${cleaned.toUpperCase()}`;
    }

    private emit<E extends keyof NotificationServerToClientEvents>(
        userId: string,
        event: E,
        payload: Parameters<NotificationServerToClientEvents[E]>[0]
    ) {
        if (!this.io) return;
        this.io.to(this.roomName(userId)).emit(event, payload);
    }

    public emitNewNotification(userId: string, payload: NotificationNewEventPayload) {
        this.emit(userId, 'notification:new', payload);
    }

    public emitNotificationsMarkedAsRead(
        userId: string,
        payload: NotificationReadEventPayload
    ) {
        this.emit(userId, 'notification:read', payload);
    }

    public emitNotificationsDeleted(
        userId: string,
        payload: NotificationDeletedEventPayload
    ) {
        this.emit(userId, 'notification:deleted', payload);
    }

    public emitUnreadCount(userId: string, payload: NotificationUnreadEventPayload) {
        this.emit(userId, 'notification:unread', payload);
    }

    public emitTaskComment(taskId: string, payload: TaskCommentPayload) {
        if (!this.io) return;
        const room = this.taskRoomName(taskId);
        if (!room) return;
        this.io.to(room).emit('task:comment:new', payload);
    }

    private chatRoomName(conversationIdInput?: unknown) {
        if (typeof conversationIdInput !== 'string') return '';
        const cleaned = conversationIdInput.trim();
        if (!cleaned) return '';
        return `${CHAT_ROOM_PREFIX}${cleaned}`;
    }

    public emitChatMessage(
        conversationId: string,
        payload: unknown,
        recipientUserIds: string[]
    ) {
        if (!this.io) return;
        const room = this.chatRoomName(conversationId);
        if (room) {
            this.io.to(room).emit('chat:message:new', payload);
        }
        recipientUserIds.forEach((userId) => {
            this.io?.to(this.roomName(userId)).emit('chat:message:new', payload);
        });
    }

    public emitChatRead(
        conversationId: string,
        payload: { conversationId: string; userEmail: string; messageIds: string[] },
        recipientUserIds: string[]
    ) {
        if (!this.io) return;
        const room = this.chatRoomName(conversationId);
        if (room) {
            this.io.to(room).emit('chat:read', payload);
        }
        recipientUserIds.forEach((userId) => {
            this.io?.to(this.roomName(userId)).emit('chat:read', payload);
        });
    }

    public emitChatUnread(
        conversationId: string,
        payload: { conversationId: string; unreadCount: number; userEmail?: string },
        recipientUserIds: string[]
    ) {
        if (!this.io) return;
        const room = this.chatRoomName(conversationId);
        if (room) {
            this.io.to(room).emit('chat:unread', payload);
        }
        recipientUserIds.forEach((userId) => {
            this.io?.to(this.roomName(userId)).emit('chat:unread', payload);
        });
    }
}

const globalForSocket = globalThis as typeof globalThis & {
    notificationSocketGateway?: NotificationSocketGateway;
};

const createGateway = () => new NotificationSocketGateway();
const existingGateway = globalForSocket.notificationSocketGateway;
const isGatewayCompatible =
    existingGateway &&
    typeof existingGateway.emitChatMessage === 'function' &&
    typeof existingGateway.emitChatRead === 'function' &&
    typeof existingGateway.emitChatUnread === 'function';

export const notificationSocketGateway = isGatewayCompatible
    ? existingGateway
    : createGateway();

if (!globalForSocket.notificationSocketGateway || !isGatewayCompatible) {
    globalForSocket.notificationSocketGateway = notificationSocketGateway;
}

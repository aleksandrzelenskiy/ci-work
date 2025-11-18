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
        });
    }

    private roomName(userId: string) {
        return `${USER_ROOM_PREFIX}${userId}`;
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
}

const globalForSocket = globalThis as typeof globalThis & {
    notificationSocketGateway?: NotificationSocketGateway;
};

export const notificationSocketGateway =
    globalForSocket.notificationSocketGateway ?? new NotificationSocketGateway();

if (!globalForSocket.notificationSocketGateway) {
    globalForSocket.notificationSocketGateway = notificationSocketGateway;
}

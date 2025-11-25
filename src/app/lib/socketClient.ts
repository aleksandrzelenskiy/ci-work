'use client';

import { NOTIFICATIONS_SOCKET_PATH } from '@/config/socket';
import { io, type Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;
let socketPromise: Promise<Socket> | null = null;

const fetchSocketToken = async (): Promise<string | null> => {
    try {
        const res = await fetch('/api/notifications/socket-auth', { cache: 'no-store' });
        const payload = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            token?: string;
        };
        if (!res.ok || payload.ok !== true || !payload.token) {
            return null;
        }
        return payload.token;
    } catch (error) {
        console.error('socketClient: failed to fetch token', error);
        return null;
    }
};

const createSocketClient = async (): Promise<Socket> => {
    try {
        await fetch('/api/socket', { cache: 'no-store' });
    } catch (error) {
        console.error('socketClient: failed to warm up socket API', error);
    }
    const token = await fetchSocketToken();

    const socket = io({
        path: NOTIFICATIONS_SOCKET_PATH,
        transports: ['websocket', 'polling'],
        withCredentials: true,
        auth: token ? { token } : undefined,
    });

    socketInstance = socket;

    socket.on('disconnect', (reason) => {
        if (reason === 'io server disconnect') {
            socketInstance = null;
        }
    });
    socket.on('connect_error', () => {
        socketInstance = null;
    });

    return socket;
};

export const getSocketClient = async (): Promise<Socket> => {
    if (socketInstance) {
        return socketInstance;
    }
    if (!socketPromise) {
        socketPromise = createSocketClient().catch((error) => {
            socketPromise = null;
            throw error;
        });
    }
    return socketPromise;
};

export default getSocketClient;

// src/pages/api/socket.ts

import type { NextApiRequest } from 'next';
import { Server as SocketIOServer } from 'socket.io';
import type { NextApiResponseServerIO } from '@/types/socket';
import { NOTIFICATIONS_SOCKET_PATH } from '@/config/socket';
import { notificationSocketGateway } from '@/server/socket/notificationSocket';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default function handler(req: NextApiRequest, res: NextApiResponseServerIO) {
    if (!res.socket.server.io) {
        const io = new SocketIOServer(res.socket.server, {
            path: NOTIFICATIONS_SOCKET_PATH,
        });
        notificationSocketGateway.bindServer(io);
        res.socket.server.io = io;
    }
    res.end();
}

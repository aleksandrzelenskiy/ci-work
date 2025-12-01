'use client';

import React from 'react';
import {
    Badge,
    Box,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    SxProps,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import EmailIcon from '@mui/icons-material/Email';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import MessengerInterface from '@/app/components/MessengerInterface';
import { fetchSocketToken } from '@/app/lib/socketClient';
import { NOTIFICATIONS_SOCKET_PATH } from '@/config/socket';
import type {
    ChatClientToServerEvents,
    ChatServerToClientEvents,
    MessengerMessageDTO,
} from '@/app/types/messenger';
import type { Socket } from 'socket.io-client';

type MessengerTriggerProps = {
    buttonSx?: SxProps<Theme>;
};

type SocketModule = typeof import('socket.io-client');
type SocketConnector =
    | SocketModule['io']
    | SocketModule['connect']
    | SocketModule['default'];

type ChatSocket = Socket<ChatServerToClientEvents, ChatClientToServerEvents>;

export default function MessengerTrigger({ buttonSx }: MessengerTriggerProps) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [open, setOpen] = React.useState(false);
    const [unreadCount, setUnreadCount] = React.useState(0);
    const unreadByConversationRef = React.useRef<Record<string, number>>({});
    const [forceFullScreen, setForceFullScreen] = React.useState(false);
    const userEmailRef = React.useRef('');
    const socketRef = React.useRef<ChatSocket | null>(null);
    const seenMessageIdsRef = React.useRef<Set<string>>(new Set());
    const joinedConversationsRef = React.useRef<Set<string>>(new Set());

    const fullScreen = isMobile || forceFullScreen;

    const handleClose = () => {
        setOpen(false);
        setForceFullScreen(false);
    };

    const recomputeTotal = React.useCallback((map: Record<string, number>) => {
        const total = Object.values(map).reduce((sum, value) => sum + (value || 0), 0);
        setUnreadCount(total);
    }, []);

    const joinAllConversations = React.useCallback(() => {
        const socket = socketRef.current;
        if (!socket) return;
        joinedConversationsRef.current.forEach((conversationId) => {
            socket.emit('chat:join', { conversationId });
        });
    }, []);

    const syncUnread = React.useCallback(async () => {
        try {
            const res = await fetch('/api/messenger/conversations', { cache: 'no-store' });
            const payload = (await res.json().catch(() => ({}))) as {
                ok?: boolean;
                conversations?: Array<{ id: string; unreadCount: number }>;
                userEmail?: string;
            };
            if (!res.ok || payload.ok !== true || !payload.conversations) return;
            const nextMap: Record<string, number> = {};
            payload.conversations.forEach((item) => {
                nextMap[item.id] = item.unreadCount ?? 0;
            });
            userEmailRef.current = (payload.userEmail ?? '').toLowerCase();
            joinedConversationsRef.current = new Set(payload.conversations.map((item) => item.id).filter(Boolean));
            joinAllConversations();
            unreadByConversationRef.current = nextMap;
            recomputeTotal(nextMap);
        } catch (error) {
            console.error('messenger-trigger: syncUnread failed', error);
        }
    }, [joinAllConversations, recomputeTotal]);

    React.useEffect(() => {
        void syncUnread();
    }, [syncUnread]);

    React.useEffect(() => {
        let cleanup: (() => void) | undefined;
        let cancelled = false;

        const connectSocket = async (): Promise<ChatSocket | null> => {
            if (socketRef.current) return socketRef.current;
            try {
                await fetch('/api/socket', { cache: 'no-store' });
            } catch (error) {
                console.error('messenger-trigger: warm socket failed', error);
            }
            try {
                const token = await fetchSocketToken();
                if (cancelled) return null;
                if (!token) {
                    console.error('messenger-trigger: socket token is unavailable');
                    return null;
                }
                const socketModule = (await import('socket.io-client')) as SocketModule;
                const { io, connect, default: defaultConnector } = socketModule;
                const socketConnector = io ?? connect ?? defaultConnector ?? null;
                if (!socketConnector) {
                    console.error('messenger-trigger: Socket.io client is unavailable');
                    return null;
                }
                const instance = (socketConnector as SocketConnector)({
                    path: NOTIFICATIONS_SOCKET_PATH,
                    transports: ['websocket', 'polling'],
                    withCredentials: true,
                    auth: { token },
                }) as ChatSocket;
                socketRef.current = instance;
                return instance;
            } catch (error) {
                console.error('messenger-trigger: socket connect failed', error);
                return null;
            }
        };

        const attachSocket = async () => {
            try {
                const socket = await connectSocket();
                if (!socket || cancelled) return;
                const handleNewMessage = (message: MessengerMessageDTO) => {
                    if (message.id && seenMessageIdsRef.current.has(message.id)) return;
                    if (message.id) {
                        seenMessageIdsRef.current.add(message.id);
                    }
                    if (!message.conversationId) return;
                    const currentEmail = userEmailRef.current;
                    if (currentEmail && message.senderEmail === currentEmail) return;
                    const alreadyRead = Array.isArray(message.readBy)
                        ? message.readBy.map((v) => v.toLowerCase()).includes(currentEmail)
                        : false;
                    if (alreadyRead) return;
                    if (message.conversationId && !joinedConversationsRef.current.has(message.conversationId)) {
                        joinedConversationsRef.current.add(message.conversationId);
                        socket.emit('chat:join', { conversationId: message.conversationId });
                    }
                    const prev = unreadByConversationRef.current;
                    const next = { ...prev, [message.conversationId]: (prev[message.conversationId] ?? 0) + 1 };
                    unreadByConversationRef.current = next;
                    recomputeTotal(next);
                    if (!currentEmail) {
                        void syncUnread();
                    }
                };

                const handleUnread = (payload: { conversationId: string; unreadCount: number; userEmail?: string }) => {
                    const currentEmail = userEmailRef.current;
                    const targetEmail = (payload.userEmail ?? '').toLowerCase();
                    if (targetEmail && currentEmail && targetEmail !== currentEmail) return;
                    if (payload.conversationId && !joinedConversationsRef.current.has(payload.conversationId)) {
                        joinedConversationsRef.current.add(payload.conversationId);
                        socket.emit('chat:join', { conversationId: payload.conversationId });
                    }
                    const prev = unreadByConversationRef.current;
                    const next = { ...prev, [payload.conversationId]: payload.unreadCount ?? 0 };
                    unreadByConversationRef.current = next;
                    recomputeTotal(next);
                };

                const handleConnect = () => {
                    joinAllConversations();
                    void syncUnread();
                };

                socket.on('chat:message:new', handleNewMessage);
                socket.on('chat:unread', handleUnread);
                socket.on('connect', handleConnect);
                socket.io.on('reconnect', handleConnect);

                if (socket.connected) {
                    handleConnect();
                } else {
                    // ensure connection attempt kicks in if autoConnect was disabled
                    socket.connect();
                }

                cleanup = () => {
                    socket.off('chat:message:new', handleNewMessage);
                    socket.off('chat:unread', handleUnread);
                    socket.off('connect', handleConnect);
                    socket.io.off('reconnect', handleConnect);
                };

                await syncUnread();
            } catch (error) {
                console.error('messenger-trigger: socket attach failed', error);
            }
        };

        const cleanupPromise = attachSocket();
        const retryTimer = setTimeout(() => {
            if (!socketRef.current) {
                void attachSocket();
            }
        }, 5000);
        return () => {
            cancelled = true;
            cleanupPromise.then(() => cleanup?.());
            clearTimeout(retryTimer);
        };
    }, [joinAllConversations, recomputeTotal, syncUnread]);

    const handleUnreadChange = (count: number, unreadMap?: Record<string, number>) => {
        if (unreadMap) {
            unreadByConversationRef.current = unreadMap;
            recomputeTotal(unreadMap);
        } else {
            setUnreadCount(count);
        }
    };

    const toggleFullScreen = () => {
        setForceFullScreen((prev) => !prev);
    };

    return (
        <>
            <IconButton
                color='inherit'
                sx={buttonSx}
                onClick={() => setOpen(true)}
                aria-label='Открыть мессенджер'
            >
                <Badge
                    badgeContent={unreadCount}
                    color={unreadCount > 0 ? 'primary' : 'default'}
                    overlap='circular'
                >
                    <EmailIcon fontSize='small' />
                </Badge>
            </IconButton>
            <Dialog
                open={open}
                onClose={handleClose}
                fullWidth
                fullScreen={fullScreen}
                keepMounted
                maxWidth={fullScreen ? false : 'lg'}
                aria-labelledby='messenger-dialog-title'
                slotProps={{
                    paper: {
                        sx: {
                            borderRadius: fullScreen ? 0 : undefined,
                            m: isMobile ? 0 : undefined,
                        },
                    },
                }}
            >
                {!isMobile ? (
                    <DialogTitle
                        id='messenger-dialog-title'
                        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                        <Typography variant='h6' fontWeight={700}>
                            Messager
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Tooltip title={fullScreen ? 'Свернуть' : 'На весь экран'}>
                                <IconButton onClick={toggleFullScreen} aria-label='Переключить полноэкранный режим'>
                                    {fullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                                </IconButton>
                            </Tooltip>
                            <IconButton onClick={handleClose} aria-label='Закрыть мессенджер'>
                                <CloseIcon />
                            </IconButton>
                        </Box>
                    </DialogTitle>
                ) : (
                    <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
                        <IconButton
                            onClick={handleClose}
                            aria-label='Закрыть мессенджер'
                            size='small'
                            sx={{ bgcolor: 'rgba(0,0,0,0.05)' }}
                        >
                            <CloseIcon fontSize='small' />
                        </IconButton>
                    </Box>
                )}
                <DialogContent
                    dividers={!isMobile && !fullScreen}
                    sx={{
                        p: isMobile ? 0 : 2,
                        bgcolor: 'transparent',
                    }}
                >
                    <MessengerInterface
                        onUnreadChangeAction={handleUnreadChange}
                        isOpen={open}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
}

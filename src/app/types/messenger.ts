export type ConversationType = 'org' | 'project' | 'direct';

export type MessengerConversationDTO = {
    id: string;
    orgId: string;
    type: ConversationType;
    title: string;
    projectKey?: string | null;
    participants: string[];
    unreadCount: number;
    lastMessagePreview?: string;
    updatedAt?: string;
    counterpartName?: string;
    counterpartAvatar?: string;
    counterpartEmail?: string;
};

export type MessengerMessageDTO = {
    id: string;
    conversationId: string;
    orgId: string;
    senderEmail: string;
    senderName?: string;
    text: string;
    readBy: string[];
    createdAt: string;
};

export type ChatServerToClientEvents = {
    'chat:message:new': (payload: MessengerMessageDTO) => void;
    'chat:read': (payload: { conversationId: string; userEmail: string; messageIds: string[] }) => void;
    'chat:unread': (payload: { conversationId: string; unreadCount: number; userEmail?: string }) => void;
};

export type ChatClientToServerEvents = {
    'chat:join': (payload: { conversationId: string }) => void;
    'chat:leave': (payload: { conversationId: string }) => void;
};

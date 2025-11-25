'use client';

import React from 'react';
import {
    Avatar,
    Box,
    Button,
    CircularProgress,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import type { Socket } from 'socket.io-client';
import { getSocketClient } from '@/app/lib/socketClient';

export type TaskComment = {
    _id: string;
    text: string;
    author: string;
    authorId: string;
    createdAt: string | Date;
    photoUrl?: string;
    profilePic?: string;
};

type TaskCommentsProps = {
    taskId?: string | null;
    initialComments?: TaskComment[] | null;
    onTaskUpdated?: (task: { comments?: TaskComment[]; events?: unknown }) => void;
};

type TaskSocketServerToClientEvents = {
    'task:comment:new': (comment: TaskComment) => void;
};

type TaskSocketClientToServerEvents = {
    'task:join': (payload: { taskId: string }) => void;
    'task:leave': (payload: { taskId: string }) => void;
};

type TaskSocket = Socket<TaskSocketServerToClientEvents, TaskSocketClientToServerEvents>;

const formatDateTime = (value: string | Date) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('ru-RU');
};

const isImageUrl = (url: string) => {
    const clean = url.split('?')[0].toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(clean);
};

export default function TaskComments({
    taskId,
    initialComments,
    onTaskUpdated,
}: TaskCommentsProps) {
    const [comments, setComments] = React.useState<TaskComment[]>(initialComments ?? []);
    const [text, setText] = React.useState('');
    const [file, setFile] = React.useState<File | null>(null);
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const upsertComment = React.useCallback((nextComment: TaskComment) => {
        setComments((prev) => {
            const existingIndex = prev.findIndex((comment) => comment._id === nextComment._id);
            if (existingIndex !== -1) {
                const updated = [...prev];
                updated[existingIndex] = { ...prev[existingIndex], ...nextComment };
                return updated;
            }
            return [...prev, nextComment];
        });
    }, []);

    React.useEffect(() => {
        setComments(initialComments ?? []);
    }, [initialComments]);

    React.useEffect(() => {
        if (!taskId) return undefined;

        let cancelled = false;
        let cleanup: (() => void) | null = null;

        const connectSocket = async () => {
            try {
                const socket = (await getSocketClient()) as TaskSocket;
                if (cancelled || !taskId) return;

                const handleNewComment = (comment: TaskComment) => {
                    upsertComment(comment);
                };

                socket.emit('task:join', { taskId });
                socket.on('task:comment:new', handleNewComment);

                cleanup = () => {
                    socket.off('task:comment:new', handleNewComment);
                    socket.emit('task:leave', { taskId });
                };
            } catch (socketError) {
                console.error('task comments socket error', socketError);
            }
        };

        void connectSocket();

        return () => {
            cancelled = true;
            cleanup?.();
        };
    }, [taskId, upsertComment]);

    const handleSubmit = async () => {
        if (!taskId) {
            setError('Не удалось определить задачу');
            return;
        }
        if (!text.trim()) {
            setError('Введите текст комментария');
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('text', text.trim());
            if (file) formData.append('photo', file);

            const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/comments`, {
                method: 'POST',
                body: formData,
            });
            const data = (await res.json()) as {
                comment?: TaskComment;
                task?: { comments?: TaskComment[]; events?: unknown };
                error?: string;
            };

            if (!res.ok || !data.comment) {
                setError(data.error || `Не удалось добавить комментарий (${res.status})`);
                return;
            }

            upsertComment(data.comment as TaskComment);
            setText('');
            setFile(null);

            if (data.task) {
                onTaskUpdated?.(data.task);
            }
        } catch (e) {
            console.error(e);
            setError('Произошла ошибка при отправке комментария');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Stack gap={2} sx={{ minWidth: 0 }}>
            {comments.length === 0 ? (
                <Typography color="text.secondary">Комментариев пока нет</Typography>
            ) : (
                <Stack gap={1.5}>
                    {comments.map((comment) => (
                        <Stack
                            key={comment._id}
                            direction="row"
                            spacing={1}
                            alignItems="flex-start"
                        >
                            <Avatar
                                src={comment.profilePic}
                                alt={comment.author}
                                sx={{ width: 32, height: 32 }}
                            >
                                {comment.author?.[0]?.toUpperCase() || '?'}
                            </Avatar>
                            <Paper
                                elevation={0}
                                sx={{
                                    p: 1.25,
                                    flex: 1,
                                    minWidth: 0,
                                    maxWidth: '100%',
                                    borderRadius: 3,
                                    bgcolor: '#f5f5f7',
                                    border: '1px solid #e5e5ea',
                                    boxShadow: '0 6px 18px rgba(0,0,0,0.04)',
                                }}
                            >
                                <Stack
                                    direction="row"
                                    justifyContent="space-between"
                                    alignItems="baseline"
                                    sx={{ mb: 0.75 }}
                                >
                                    <Typography variant="body2" fontWeight={600} noWrap>
                                        {comment.author}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {formatDateTime(comment.createdAt)}
                                    </Typography>
                                </Stack>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        whiteSpace: 'pre-wrap',
                                        color: 'text.primary',
                                        wordBreak: 'break-word',
                                    }}
                                >
                                    {comment.text}
                                </Typography>
                                {comment.photoUrl && (
                                    isImageUrl(comment.photoUrl) ? (
                                        <Box
                                            component="img"
                                            src={comment.photoUrl}
                                            alt="Комментарий"
                                            sx={{
                                                mt: 1,
                                                maxWidth: '100%',
                                                borderRadius: 2,
                                                border: '1px solid #e5e5ea',
                                                boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
                                            }}
                                        />
                                    ) : (
                                        <Button
                                            href={comment.photoUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            variant="outlined"
                                            size="small"
                                            sx={{
                                                alignSelf: 'flex-start',
                                                mt: 1,
                                                borderRadius: 999,
                                                textTransform: 'none',
                                                borderColor: '#d1d1d6',
                                            }}
                                        >
                                            Открыть вложение
                                        </Button>
                                    )
                                )}
                            </Paper>
                        </Stack>
                    ))}
                </Stack>
            )}

            <Stack gap={1}>
                <TextField
                    label="Новый комментарий"
                    multiline
                    minRows={3}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    fullWidth
                    placeholder="Напишите что-нибудь…"
                    InputProps={{
                        sx: {
                            borderRadius: 3,
                            bgcolor: '#f5f5f7',
                            '& fieldset': {
                                borderColor: '#e5e5ea',
                            },
                            '&:hover fieldset': {
                                borderColor: '#c7c7cc',
                            },
                            '&.Mui-focused fieldset': {
                                borderColor: '#007aff',
                            },
                        },
                    }}
                />
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Button
                        variant="text"
                        startIcon={<AttachFileOutlinedIcon />}
                        component="label"
                        sx={{
                            alignSelf: 'flex-start',
                            color: '#007aff',
                            textTransform: 'none',
                            fontWeight: 600,
                            '&:hover': { bgcolor: 'rgba(0,122,255,0.08)' },
                        }}
                    >
                        Добавить файл
                        <input
                            type="file"
                            hidden
                            accept="image/*,application/pdf"
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    setFile(e.target.files[0]);
                                }
                            }}
                        />
                    </Button>
                    {file && (
                        <Typography variant="body2" color="text.secondary">
                            {file.name}
                        </Typography>
                    )}
                </Stack>
                {error && (
                    <Typography variant="body2" color="error">
                        {error}
                    </Typography>
                )}
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={submitting || !taskId}
                    startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
                    sx={{
                        alignSelf: 'flex-start',
                        borderRadius: 999,
                        px: 2.5,
                        bgcolor: '#007aff',
                        boxShadow: '0 8px 24px rgba(0,122,255,0.25)',
                        '&:hover': {
                            bgcolor: '#0062d6',
                            boxShadow: '0 10px 28px rgba(0,122,255,0.35)',
                        },
                    }}
                >
                    Добавить комментарий
                </Button>
            </Stack>
        </Stack>
    );
}

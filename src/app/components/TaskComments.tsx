'use client';

import React from 'react';
import {
    Avatar,
    Box,
    Button,
    CircularProgress,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';

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

    React.useEffect(() => {
        setComments(initialComments ?? []);
    }, [initialComments]);

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

            setComments((prev) => [...prev, data.comment as TaskComment]);
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
        <Stack gap={2}>
            {comments.length === 0 ? (
                <Typography color="text.secondary">Комментариев пока нет</Typography>
            ) : (
                <Stack gap={1.5}>
                    {comments.map((comment) => (
                        <Stack
                            key={comment._id}
                            direction="row"
                            spacing={1.5}
                            alignItems="flex-start"
                        >
                            <Avatar
                                src={comment.profilePic}
                                alt={comment.author}
                                sx={{ width: 32, height: 32 }}
                            >
                                {comment.author?.[0]?.toUpperCase() || '?'}
                            </Avatar>
                            <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="body2" fontWeight={600}>
                                    {comment.author}
                                </Typography>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                    {comment.text}
                                </Typography>
                                {comment.photoUrl && (
                                    isImageUrl(comment.photoUrl) ? (
                                        <Box
                                            component="img"
                                            src={comment.photoUrl}
                                            alt="Комментарий"
                                            sx={{
                                                mt: 0.5,
                                                maxWidth: '100%',
                                                borderRadius: 1,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                            }}
                                        />
                                    ) : (
                                        <Button
                                            href={comment.photoUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            variant="outlined"
                                            size="small"
                                            sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                                        >
                                            Открыть вложение
                                        </Button>
                                    )
                                )}
                                <Typography variant="caption" color="text.secondary">
                                    {formatDateTime(comment.createdAt)}
                                </Typography>
                            </Stack>
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
                />
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Button
                        variant="text"
                        startIcon={<AttachFileOutlinedIcon />}
                        component="label"
                        sx={{ alignSelf: 'flex-start' }}
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
                    sx={{ alignSelf: 'flex-start' }}
                >
                    Добавить комментарий
                </Button>
            </Stack>
        </Stack>
    );
}

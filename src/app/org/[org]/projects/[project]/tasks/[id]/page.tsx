//app/org/[org]/projects/[project]/tasks/[id]/page.tsx

'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Box,
    Stack,
    Typography,
    Paper,
    Chip,
    Divider,
    IconButton,
    Tooltip,
    CircularProgress,
    Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';

type Task = {
    _id: string;
    taskId: string;
    taskName: string;
    status?: string;
    bsNumber?: string;
    bsAddress?: string;
    bsLocation?: Array<{ name: string; coordinates: string }>;
    totalCost?: number;
    priority?: 'urgent' | 'high' | 'medium' | 'low';
    dueDate?: string;
    taskType?: string;
    orderUrl?: string;
    orderNumber?: string;
    orderDate?: string;
    orderSignDate?: string;
    taskDescription?: string;
    createdAt?: string;
    updatedAt?: string;
};

export default function TaskDetailsPage() {
    const params = useParams<{ org: string; project: string; id: string }>() as {
        org: string;
        project: string;
        id: string;
    };

    const router = useRouter();

    const org = params.org?.trim();
    const project = params.project?.trim();
    const id = params.id?.trim();

    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [task, setTask] = React.useState<Task | null>(null);

    const load = React.useCallback(async () => {
        if (!org || !project || !id) return;
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(
                `/api/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(
                    project
                )}/tasks/${encodeURIComponent(id)}`,
                { cache: 'no-store' }
            );
            const data = (await res.json()) as { task?: Task; error?: string };
            if (!res.ok || !data.task) {
                setError(data.error || `Не удалось загрузить задачу (${res.status})`);
                setTask(null);
            } else {
                setTask(data.task);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Network error');
            setTask(null);
        } finally {
            setLoading(false);
        }
    }, [org, project, id]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const formatDateTime = (v?: string) => {
        if (!v) return '—';
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return v;
        return d.toLocaleString();
    };

    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title="Назад к списку">
                        <IconButton onClick={() => router.back()}>
                            <ArrowBackIcon />
                        </IconButton>
                    </Tooltip>
                    <Box>
                        <Typography variant="h5" fontWeight={700}>
                            Карточка задачи
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Организация: {org} • Проект: {project}
                        </Typography>
                    </Box>
                </Stack>
                <Stack direction="row" spacing={1}>
                    <Tooltip title="Обновить">
                        <span>
                            <IconButton onClick={() => void load()} disabled={loading}>
                                <RefreshIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    {/* здесь потом можно добавить кнопку "Редактировать" */}
                </Stack>
            </Stack>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography color="error" sx={{ mb: 1 }}>
                        {error}
                    </Typography>
                    <Button variant="outlined" onClick={() => void load()}>
                        Повторить
                    </Button>
                </Paper>
            ) : !task ? (
                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography>Задача не найдена.</Typography>
                </Paper>
            ) : (
                <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
                                {task.taskName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                ID задачи: {task.taskId} • MongoID: {task._id}
                            </Typography>
                        </Box>
                        <Stack direction="row" gap={1} flexWrap="wrap" justifyContent="flex-end">
                            {task.status && <Chip label={task.status} color="primary" variant="outlined" />}
                            {task.priority && <Chip label={`Приоритет: ${task.priority}`} size="small" />}
                        </Stack>
                    </Stack>

                    <Divider />

                    <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Базовая станция
                            </Typography>
                            <Typography variant="body1">
                                {task.bsNumber ? `BS: ${task.bsNumber}` : '—'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {task.bsAddress || 'Адрес не указан'}
                            </Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Срок
                            </Typography>
                            <Typography variant="body1">{task.dueDate ? formatDateTime(task.dueDate) : '—'}</Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Стоимость
                            </Typography>
                            <Typography variant="body1">
                                {typeof task.totalCost === 'number' ? `${task.totalCost} ₽` : '—'}
                            </Typography>
                        </Box>
                    </Stack>

                    {task.taskDescription && (
                        <>
                            <Typography variant="subtitle2" color="text.secondary">
                                Описание
                            </Typography>
                            <Typography sx={{ whiteSpace: 'pre-wrap' }}>{task.taskDescription}</Typography>
                        </>
                    )}

                    <Divider />

                    <Stack direction={{ xs: 'column', md: 'row' }} gap={2}>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Тип задачи
                            </Typography>
                            <Typography variant="body1">{task.taskType || '—'}</Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Дата создания
                            </Typography>
                            <Typography variant="body1">{formatDateTime(task.createdAt)}</Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Последнее обновление
                            </Typography>
                            <Typography variant="body1">{formatDateTime(task.updatedAt)}</Typography>
                        </Box>
                    </Stack>

                    {(task.orderNumber || task.orderUrl || task.orderDate || task.orderSignDate) && (
                        <>
                            <Divider />
                            <Typography variant="subtitle2" color="text.secondary">
                                Заказ / договор
                            </Typography>
                            <Stack gap={0.5}>
                                {task.orderNumber && <Typography>Номер: {task.orderNumber}</Typography>}
                                {task.orderDate && (
                                    <Typography>Дата заказа: {formatDateTime(task.orderDate)}</Typography>
                                )}
                                {task.orderSignDate && (
                                    <Typography>Дата подписания: {formatDateTime(task.orderSignDate)}</Typography>
                                )}
                                {task.orderUrl && (
                                    <Button
                                        href={task.orderUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        variant="text"
                                        sx={{ alignSelf: 'flex-start' }}
                                    >
                                        Открыть заказ
                                    </Button>
                                )}
                            </Stack>
                        </>
                    )}
                </Paper>
            )}
        </Box>
    );
}

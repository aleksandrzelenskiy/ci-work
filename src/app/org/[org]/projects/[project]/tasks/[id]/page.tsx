// app/org/[org]/projects/[project]/tasks/[id]/page.tsx
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Box,
    Stack,
    Typography,
    Paper,
    Chip,
    IconButton,
    Tooltip,
    CircularProgress,
    Button,
    Grid,
    Link,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditDocumentIcon from '@mui/icons-material/EditDocument';
import DeleteIcon from '@mui/icons-material/Delete';
import WorkspaceTaskDialog, {
    type TaskForEdit,
} from '@/app/workspace/components/WorkspaceTaskDialog';
import { getPriorityIcon, normalizePriority } from '@/utils/priorityIcons';
import TaskGeoLocation from '@/app/workspace/components/TaskGeoLocation';

type TaskFile = {
    url: string;
    name?: string;
    size?: number;
};

type Task = {
    _id: string;
    taskId: string;
    taskName: string;
    status?: string;
    bsNumber?: string;
    bsAddress?: string;
    bsLocation?: Array<{ name?: string; coordinates: string }>;
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
    executorId?: string;
    executorName?: string;
    executorEmail?: string;
    files?: TaskFile[];
    attachments?: string[];
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

    const [editOpen, setEditOpen] = React.useState(false);
    const [deleteOpen, setDeleteOpen] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);

    // новое: имя организации
    const [orgName, setOrgName] = React.useState<string | null>(null);

    const formatDate = (v?: string) => {
        if (!v) return '—';
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return v;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}.${mm}.${yyyy}`;
    };

    const formatPrice = (v?: number) => {
        if (typeof v !== 'number') return '—';
        return new Intl.NumberFormat('ru-RU').format(v) + ' ₽';
    };

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

    // отдельная загрузка организации по слагу
    const loadOrg = React.useCallback(async () => {
        if (!org) return;
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}`, {
                cache: 'no-store',
            });
            if (!res.ok) return;
            const data = (await res.json()) as { org?: { name?: string } };
            if (data.org?.name) {
                setOrgName(data.org.name);
            }
        } catch {
            // тихо игнорируем, оставим слаг
        }
    }, [org]);

    React.useEffect(() => {
        void load();
    }, [load]);

    React.useEffect(() => {
        void loadOrg();
    }, [loadOrg]);

    const hasAttachments =
        !!task &&
        ((Array.isArray(task.files) && task.files.length > 0) ||
            (Array.isArray(task.attachments) && task.attachments.length > 0));

    const toEditShape = (t: Task): TaskForEdit => {
        return {
            _id: t._id,
            taskId: t.taskId,
            taskName: t.taskName,
            status: t.status,
            dueDate: t.dueDate,
            bsNumber: t.bsNumber,
            bsAddress: t.bsAddress,
            taskDescription: t.taskDescription,
            totalCost: t.totalCost,
            priority: t.priority,
            executorId: t.executorId,
            executorName: t.executorName,
            executorEmail: t.executorEmail,
            files: t.files?.map((f) => ({ name: f.name, url: f.url, size: f.size })),
            attachments: t.attachments,
            bsLocation: t.bsLocation
                ? t.bsLocation.map((loc, idx) => ({
                    name: loc.name ?? `Точка ${idx + 1}`,
                    coordinates: loc.coordinates,
                }))
                : undefined,
        };
    };

    const handleDelete = async () => {
        if (!org || !project || !id) return;
        setDeleting(true);
        try {
            const res = await fetch(
                `/api/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(
                    project
                )}/tasks/${encodeURIComponent(id)}`,
                { method: 'DELETE' }
            );
            if (!res.ok) {
                console.error('Не удалось удалить задачу');
            } else {
                router.back();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setDeleting(false);
            setDeleteOpen(false);
        }
    };

    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                    <Tooltip title="Назад">
                        <IconButton onClick={() => router.back()}>
                            <ArrowBackIcon />
                        </IconButton>
                    </Tooltip>
                    <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
                            <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
                                {task?.taskName || 'Задача'}
                            </Typography>
                            {task?.bsNumber && (
                                <Typography variant="body2" color="text.secondary">
                                    {task.bsNumber}
                                </Typography>
                            )}
                            {task?.status && (
                                <Chip label={task.status} size="small" color="primary" variant="outlined" />
                            )}
                        </Stack>
                        {/* вот тут меняем вывод */}
                        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            Организация:{' '}
                            <Link
                                href={`/org/${encodeURIComponent(org)}`}
                                underline="hover"
                                color="inherit"
                            >
                                {orgName || org}
                            </Link>
                            •
                            Проект:{' '}
                            <Link
                                href={`/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/tasks`}
                                underline="hover"
                                color="inherit"
                            >
                                {project}
                            </Link>
                        </Typography>
                        {task?.taskId && (
                            <Chip
                                label={task.taskId}
                                size="small"
                                variant="outlined"
                                sx={{ mt: 0.5 }}
                            />
                        )}

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
                    <Tooltip title="Редактировать">
                        <span>
                            <IconButton onClick={() => task && setEditOpen(true)} disabled={loading || !task}>
                                <EditDocumentIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Удалить">
                        <span>
                            <IconButton
                                onClick={() => task && setDeleteOpen(true)}
                                disabled={loading || !task}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
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
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Grid container spacing={2}>
                        {/* Информация */}
                        <Grid item xs={12} md={6} lg={3}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    Информация
                                </Typography>
                                <Divider sx={{ mb: 1.5 }} />

                                <Box sx={{ mb: 1 }}>
                                    <Typography variant="body1" color="text.secondary">
                                        Базовая станция
                                    </Typography>
                                    <Typography variant="body1">
                                        {task.bsNumber ? `BS: ${task.bsNumber}` : '—'}
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary">
                                        {task.bsAddress || 'Адрес не указан'}
                                    </Typography>
                                </Box>

                                <Box sx={{ mb: 1 }}>
                                    <Typography variant="body1" color="text.secondary">
                                        Срок
                                    </Typography>
                                    <Typography variant="body1">
                                        {task.dueDate ? formatDate(task.dueDate) : '—'}
                                    </Typography>
                                </Box>

                                <Box sx={{ mb: 1 }}>
                                    <Typography variant="body1" color="text.secondary">
                                        Приоритет
                                    </Typography>
                                    <Stack direction="row" spacing={0.75} alignItems="center">
                                        {getPriorityIcon(
                                            (normalizePriority(task.priority as string) ?? 'medium') as
                                                | 'urgent'
                                                | 'high'
                                                | 'medium'
                                                | 'low'
                                        )}
                                        <Typography variant="body1">
                                            {task.priority || '—'}
                                        </Typography>
                                    </Stack>
                                </Box>

                                <Box sx={{ mb: 1 }}>
                                    <Typography variant="body1" color="text.secondary">
                                        Стоимость
                                    </Typography>
                                    <Typography variant="body1">{formatPrice(task.totalCost)}</Typography>
                                </Box>

                                {(task.executorName || task.executorEmail) && (
                                    <Box sx={{ mb: 1 }}>
                                        <Typography variant="body1" color="text.secondary">
                                            Исполнитель
                                        </Typography>
                                        <Typography variant="body1">
                                            {task.executorName || '—'}
                                        </Typography>
                                        {task.executorEmail && (
                                            <Typography variant="body1" color="text.secondary">
                                                {task.executorEmail}
                                            </Typography>
                                        )}
                                    </Box>
                                )}

                                <Box sx={{ mb: 1 }}>
                                    <Typography variant="body1" color="text.secondary">
                                        Тип задачи
                                    </Typography>
                                    <Typography variant="body1">{task.taskType || '—'}</Typography>
                                </Box>

                                <Box sx={{ mb: 1 }}>
                                    <Typography variant="body1" color="text.secondary">
                                        Создана
                                    </Typography>
                                    <Typography variant="body1">
                                        {task.createdAt ? formatDate(task.createdAt) : '—'}
                                    </Typography>
                                </Box>

                                <Box>
                                    <Typography variant="body1" color="text.secondary">
                                        Обновлена
                                    </Typography>
                                    <Typography variant="body1">
                                        {task.updatedAt ? formatDate(task.updatedAt) : '—'}
                                    </Typography>
                                </Box>
                            </Paper>
                        </Grid>

                        {/* Описание */}
                        <Grid item xs={12} md={6} lg={3}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    Описание
                                </Typography>
                                <Divider sx={{ mb: 1.5 }} />
                                {task.taskDescription ? (
                                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                                        {task.taskDescription}
                                    </Typography>
                                ) : (
                                    <Typography color="text.secondary">Нет описания</Typography>
                                )}
                            </Paper>
                        </Grid>

                        {/* Вложения — только если есть */}
                        {hasAttachments && (
                            <Grid item xs={12} md={6} lg={3}>
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                        Вложения
                                    </Typography>
                                    <Divider sx={{ mb: 1.5 }} />
                                    <Stack gap={1}>
                                        {task.files?.map((file, idx) => (
                                            <Link
                                                key={`file-${idx}`}
                                                href={file.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                underline="hover"
                                            >
                                                {file.name || `Файл ${idx + 1}`}
                                            </Link>
                                        ))}
                                        {task.attachments?.map((url, idx) => (
                                            <Link
                                                key={`att-${idx}`}
                                                href={url}
                                                target="_blank"
                                                rel="noreferrer"
                                                underline="hover"
                                            >
                                                {decodeURIComponent(url.split('/').pop() || `Вложение ${idx + 1}`)}
                                            </Link>
                                        ))}
                                    </Stack>
                                </Paper>
                            </Grid>
                        )}

                        {/* Геолокация */}
                        <Grid item xs={12} md={6} lg={3}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <TaskGeoLocation locations={task.bsLocation} />
                            </Paper>
                        </Grid>
                    </Grid>

                    {(task.orderNumber || task.orderUrl || task.orderDate || task.orderSignDate) && (
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                Заказ / договор
                            </Typography>
                            <Divider sx={{ mb: 1.5 }} />
                            <Stack gap={0.5}>
                                {task.orderNumber && <Typography>Номер: {task.orderNumber}</Typography>}
                                {task.orderDate && (
                                    <Typography>Дата заказа: {formatDate(task.orderDate)}</Typography>
                                )}
                                {task.orderSignDate && (
                                    <Typography>Дата подписания: {formatDate(task.orderSignDate)}</Typography>
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
                        </Paper>
                    )}
                </Box>
            )}

            {task && (
                <WorkspaceTaskDialog
                    open={editOpen}
                    org={org}
                    project={project}
                    onCloseAction={() => setEditOpen(false)}
                    onCreatedAction={() => {
                        setEditOpen(false);
                        void load();
                    }}
                    mode="edit"
                    initialTask={task ? toEditShape(task) : null}
                />
            )}

            <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)}>
                <DialogTitle>Удалить задачу?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Это действие нельзя будет отменить. Задача будет удалена из проекта.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>
                        Отмена
                    </Button>
                    <Button
                        onClick={handleDelete}
                        color="error"
                        variant="contained"
                        disabled={deleting}
                        startIcon={deleting ? <CircularProgress size={18} color="inherit" /> : null}
                    >
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

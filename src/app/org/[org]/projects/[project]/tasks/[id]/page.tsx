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
    Link,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Accordion,
    AccordionSummary,
    AccordionDetails,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditNoteIcon from '@mui/icons-material/EditNote';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import WorkspaceTaskDialog, {
    type TaskForEdit,
} from '@/app/workspace/components/WorkspaceTaskDialog';
import { getPriorityIcon, normalizePriority } from '@/utils/priorityIcons';
import TaskGeoLocation from '@/app/workspace/components/TaskGeoLocation';
import { getStatusColor } from '@/utils/statusColors';
import Masonry from '@mui/lab/Masonry';
import {
    Timeline,
    TimelineItem,
    TimelineSeparator,
    TimelineDot,
    TimelineConnector,
    TimelineContent,
    TimelineOppositeContent,
} from '@mui/lab';

type TaskFile = {
    url: string;
    name?: string;
    size?: number;
};

type TaskEventDetailsValue = string | number | boolean | null | undefined;

type Change = {
    from?: unknown;
    to?: unknown;
};

type TaskEventDetails = Record<string, TaskEventDetailsValue | Change>;

type TaskEvent = {
    action: string;
    author: string;
    authorId: string;
    date: string;
    details?: TaskEventDetails;
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
    events?: TaskEvent[];
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

    const [orgName, setOrgName] = React.useState<string | null>(null);

    const asText = (x: unknown): string => {
        if (x === null || typeof x === 'undefined') return '—';
        if (typeof x === 'string') {
            const d = new Date(x);
            if (!Number.isNaN(d.getTime())) return d.toLocaleString('ru-RU');
        }
        return String(x);
    };

    const formatDate = (v?: string) => {
        if (!v) return '—';
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return v;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}.${mm}.${yyyy}`;
    };

    const formatDateTime = (v?: string) => {
        if (!v) return '—';
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return v;
        return d.toLocaleString('ru-RU');
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
            // ignore
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

    const sortedEvents = React.useMemo(() => {
        if (!task?.events) return [];
        return [...task.events].sort((a, b) => {
            const da = new Date(a.date).getTime();
            const db = new Date(b.date).getTime();
            return db - da;
        });
    }, [task?.events]);

    const getEventTitle = (action: string): string => {
        if (action === 'created') return 'Задача создана';
        if (action === 'status_changed_assigned') return 'Задача назначена исполнителю';
        if (action === 'updated') return 'Задача изменена';
        return action;
    };

    const isChange = (value: unknown): value is Change => {
        return (
            typeof value === 'object' &&
            value !== null &&
            ('from' in (value as Record<string, unknown>) ||
                'to' in (value as Record<string, unknown>))
        );
    };

    const getDetailString = (details: TaskEventDetails, key: string): string => {
        const raw = details[key];
        if (
            typeof raw === 'string' ||
            typeof raw === 'number' ||
            typeof raw === 'boolean' ||
            raw === null ||
            typeof raw === 'undefined'
        ) {
            return raw === null || typeof raw === 'undefined' ? '—' : String(raw);
        }

        return '—';
    };

    const renderEventDetails = (ev: TaskEvent): React.ReactNode => {
        const d: TaskEventDetails = ev.details || {};

        if (ev.action === 'created') {
            const taskNameStr = getDetailString(d, 'taskName');
            const bsNumberStr = getDetailString(d, 'bsNumber');
            const statusStr = getDetailString(d, 'status');
            const priorityStr = getDetailString(d, 'priority');

            return (
                <>
                    <Typography variant="caption" display="block">
                        Задача: {taskNameStr}
                    </Typography>
                    <Typography variant="caption" display="block">
                        BS: {bsNumberStr}
                    </Typography>
                    <Typography variant="caption" display="block">
                        Статус: {statusStr}
                    </Typography>
                    <Typography variant="caption" display="block">
                        Приоритет: {priorityStr}
                    </Typography>
                </>
            );
        }

        if (ev.action === 'status_changed_assigned') {
            const executorStr = getDetailString(d, 'executorName');
            const executorEmailStr = getDetailString(d, 'executorEmail');

            return (
                <>
                    <Typography variant="caption" display="block">
                        Исполнитель: {executorStr}
                    </Typography>
                    {executorEmailStr !== '—' && (
                        <Typography variant="caption" display="block">
                            Email: {executorEmailStr}
                        </Typography>
                    )}
                </>
            );
        }

        if (ev.action === 'updated') {
            return Object.entries(d).map(([key, value]) => {
                if (isChange(value)) {
                    return (
                        <Typography key={key} variant="caption" display="block">
                            {key}: {asText(value.from)} → {asText(value.to)}
                        </Typography>
                    );
                }
                return (
                    <Typography key={key} variant="caption" display="block">
                        {key}: {asText(value)}
                    </Typography>
                );
            });
        }

        return Object.entries(d).map(([key, value]) => (
            <Typography key={key} variant="caption" display="block">
                {key}: {value === null || typeof value === 'undefined' ? '—' : String(value)}
            </Typography>
        ));
    };

    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Header */}
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
                                <Typography variant="h6">{task.bsNumber}</Typography>
                            )}

                            {task?.taskId && (
                                <Chip
                                    label={task.taskId}
                                    size="small"
                                    variant="outlined"
                                    sx={{ mt: 0.5 }}
                                />
                            )}
                        </Stack>

                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}
                        >
                            Организация:{' '}
                            <Link
                                href={`/org/${encodeURIComponent(org)}`}
                                underline="hover"
                                color="inherit"
                            >
                                {orgName || org}
                            </Link>
                            • Проект:{' '}
                            <Link
                                href={`/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(
                                    project
                                )}/tasks`}
                                underline="hover"
                                color="inherit"
                            >
                                {project}
                            </Link>
                        </Typography>

                        {task?.status && (
                            <Chip
                                label={task.status}
                                size="small"
                                sx={{
                                    bgcolor: getStatusColor(task.status),
                                    color: 'rgba(0,0,0,0.87)',
                                    fontWeight: 500,
                                }}
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
                            <IconButton
                                onClick={() => task && setEditOpen(true)}
                                disabled={loading || !task}
                            >
                                <EditNoteIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Удалить">
                        <span>
                            <IconButton
                                onClick={() => task && setDeleteOpen(true)}
                                disabled={loading || !task}
                            >
                                <DeleteOutlineIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
            </Stack>

            {/* Content */}
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
                    <Masonry
                        columns={{ xs: 1, sm: 2, md: 3 }}
                        spacing={2}
                    >
                        {/* Информация */}
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography
                                variant="subtitle1"
                                fontWeight={600}
                                gutterBottom
                                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                            >
                                <InfoOutlinedIcon fontSize="small" />
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
                                <Typography variant="body1">
                                    {formatPrice(task.totalCost)}
                                </Typography>
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
                                <Typography variant="body1">
                                    {task.taskType || '—'}
                                </Typography>
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

                        {/* Описание */}
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <Typography
                                variant="subtitle1"
                                fontWeight={600}
                                gutterBottom
                                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                            >
                                <DescriptionOutlinedIcon fontSize="small" />
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

                        {/* Вложения — если есть */}
                        {hasAttachments && (
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                    gutterBottom
                                    sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                >
                                    <AttachFileOutlinedIcon fontSize="small" />
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
                                            {decodeURIComponent(
                                                url.split('/').pop() || `Вложение ${idx + 1}`
                                            )}
                                        </Link>
                                    ))}
                                </Stack>
                            </Paper>
                        )}

                        {/* Геолокация */}
                        <Paper variant="outlined" sx={{ p: 2 }}>
                            <TaskGeoLocation locations={task.bsLocation} />
                        </Paper>

                        {/* Заказ / договор — если есть */}
                        {(task.orderNumber ||
                            task.orderUrl ||
                            task.orderDate ||
                            task.orderSignDate) && (
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                    Заказ / договор
                                </Typography>
                                <Divider sx={{ mb: 1.5 }} />
                                <Stack gap={0.5}>
                                    {task.orderNumber && (
                                        <Typography>Номер: {task.orderNumber}</Typography>
                                    )}
                                    {task.orderDate && (
                                        <Typography>
                                            Дата заказа: {formatDate(task.orderDate)}
                                        </Typography>
                                    )}
                                    {task.orderSignDate && (
                                        <Typography>
                                            Дата подписания: {formatDate(task.orderSignDate)}
                                        </Typography>
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

                        {/* История */}
                        <Paper variant="outlined" sx={{ p: 0, minWidth: 0 }}>
                            <Accordion
                                defaultExpanded
                                disableGutters
                                elevation={0}
                                sx={{ '&:before': { display: 'none' } }}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                >
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        История
                                    </Typography>
                                </AccordionSummary>
                                <AccordionDetails sx={{ pt: 0 }}>
                                    <Divider sx={{ mb: 1.5 }} />
                                    {sortedEvents.length === 0 ? (
                                        <Typography color="text.secondary" sx={{ px: 2, pb: 1.5 }}>
                                            История пуста
                                        </Typography>
                                    ) : (
                                        <Timeline
                                            sx={{
                                                p: 0,
                                                m: 0,
                                                px: 2,
                                                pb: 1.5,
                                                '& .MuiTimelineOppositeContent-root': {
                                                    flex: '0 0 110px',
                                                    whiteSpace: 'normal',
                                                },
                                                '& .MuiTimelineContent-root': {
                                                    wordBreak: 'break-word',
                                                    overflowWrap: 'anywhere',
                                                    minWidth: 0,
                                                },
                                            }}
                                        >
                                            {sortedEvents.map((ev, idx) => (
                                                <TimelineItem key={idx}>
                                                    <TimelineOppositeContent sx={{ pr: 1 }}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {formatDateTime(ev.date)}
                                                        </Typography>
                                                    </TimelineOppositeContent>
                                                    <TimelineSeparator>
                                                        <TimelineDot
                                                            color={ev.action === 'created' ? 'primary' : 'success'}
                                                        />
                                                        {idx < sortedEvents.length - 1 && <TimelineConnector />}
                                                    </TimelineSeparator>
                                                    <TimelineContent sx={{ py: 1, minWidth: 0 }}>
                                                        <Typography variant="body2" fontWeight={600}>
                                                            {getEventTitle(ev.action)}
                                                        </Typography>
                                                        <Typography variant="body2" color="text.secondary">
                                                            {ev.author}
                                                        </Typography>
                                                        <Box sx={{ mt: 0.5 }}>
                                                            {renderEventDetails(ev)}
                                                        </Box>
                                                    </TimelineContent>
                                                </TimelineItem>
                                            ))}
                                        </Timeline>
                                    )}
                                </AccordionDetails>
                            </Accordion>
                        </Paper>


                    </Masonry>

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

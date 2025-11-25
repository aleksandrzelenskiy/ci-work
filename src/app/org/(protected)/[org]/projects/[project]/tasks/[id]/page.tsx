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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditNoteIcon from '@mui/icons-material/EditNote';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CommentOutlinedIcon from '@mui/icons-material/CommentOutlined';
import TocOutlinedIcon from '@mui/icons-material/TocOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import HistoryIcon from '@mui/icons-material/History';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import WorkspaceTaskDialog, {
    type TaskForEdit,
} from '@/app/workspace/components/WorkspaceTaskDialog';
import type { ParsedWorkItem } from '@/app/workspace/components/T2/T2EstimateParser';
import { getPriorityIcon, normalizePriority } from '@/utils/priorityIcons';
import TaskGeoLocation from '@/app/workspace/components/TaskGeoLocation';
import { getStatusColor } from '@/utils/statusColors';
import TaskComments, { type TaskComment } from '@/app/components/TaskComments';
import {
    Timeline,
    TimelineItem,
    TimelineSeparator,
    TimelineDot,
    TimelineConnector,
    TimelineContent,
    TimelineOppositeContent,
} from '@mui/lab';
import Masonry from '@mui/lab/Masonry';
import { extractFileNameFromUrl, isDocumentUrl } from '@/utils/taskFiles';

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
    authorEmail?: string;
    date: string;
    details?: TaskEventDetails;
};

type WorkItem = {
    workType?: string;
    quantity?: number;
    unit?: string;
    note?: string;
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
    documents?: string[];
    events?: TaskEvent[];
    workItems?: WorkItem[];
    comments?: TaskComment[];
};

// карточка с тенью как в примере MUI
const CardItem = styled(Paper)(({ theme }) => ({
    backgroundColor: '#fff',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[3],
    ...theme.applyStyles?.('dark', {
        backgroundColor: '#1A2027',
    }),
}));

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
    const [deleteDocumentOpen, setDeleteDocumentOpen] = React.useState(false);
    const [documentToDelete, setDocumentToDelete] = React.useState<string | null>(null);
    const [documentDeleting, setDocumentDeleting] = React.useState(false);

    const [orgName, setOrgName] = React.useState<string | null>(null);
    const [workItemsFullScreen, setWorkItemsFullScreen] = React.useState(false);
    const [commentsFullScreen, setCommentsFullScreen] = React.useState(false);

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

    const attachmentLinks = React.useMemo(
        () =>
            Array.isArray(task?.attachments)
                ? task.attachments.filter((url) => !isDocumentUrl(url))
                : [],
        [task]
    );

    const documentLinks = React.useMemo(
        () => {
            const docs = Array.isArray(task?.documents) ? task.documents : [];
            const docsFromAttachments = Array.isArray(task?.attachments)
                ? task.attachments.filter((url) => isDocumentUrl(url))
                : [];
            return Array.from(new Set([...docs, ...docsFromAttachments]));
        },
        [task]
    );

    const hasWorkItems = Array.isArray(task?.workItems) && task.workItems.length > 0;
    const hasDocuments = documentLinks.length > 0;
    const hasAttachments =
        !!task &&
        ((Array.isArray(task.files) && task.files.length > 0) ||
            attachmentLinks.length > 0);

    const toEditWorkItems = (list: Task['workItems']): ParsedWorkItem[] | undefined => {
        if (!Array.isArray(list)) return undefined;
        const cleaned: ParsedWorkItem[] = [];
        list.forEach((wi) => {
            const workType = typeof wi?.workType === 'string' ? wi.workType.trim() : '';
            const unit = typeof wi?.unit === 'string' ? wi.unit.trim() : '';
            const qty = typeof wi?.quantity === 'number' ? wi.quantity : Number(wi?.quantity);
            if (!workType || !unit || !Number.isFinite(qty)) return;
            const note =
                typeof wi?.note === 'string' && wi.note.trim() ? wi.note.trim() : undefined;
            cleaned.push({ workType, quantity: qty, unit, note });
        });
        return cleaned.length ? cleaned : undefined;
    };

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
            workItems: toEditWorkItems(t.workItems),
            files: t.files?.map((f) => ({ name: f.name, url: f.url, size: f.size })),
            attachments: Array.isArray(t.attachments)
                ? t.attachments.filter((url) => !isDocumentUrl(url))
                : t.attachments,
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

    const handleDownloadDocument = async (url: string) => {
        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.error('Не удалось скачать документ');
                return;
            }
            const blob = await res.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = extractFileNameFromUrl(url, 'document');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
        } catch (e) {
            console.error(e);
        }
    };

    const openDeleteDocumentDialog = (url: string) => {
        setDocumentToDelete(url);
        setDeleteDocumentOpen(true);
    };

    const closeDeleteDocumentDialog = () => {
        if (documentDeleting) return;
        setDeleteDocumentOpen(false);
        setDocumentToDelete(null);
    };

    const confirmDeleteDocument = async () => {
        if (!task?.taskId || !documentToDelete) return;
        setDocumentDeleting(true);
        try {
            const q = new URLSearchParams({
                taskId: task.taskId,
                url: documentToDelete,
                mode: 'documents',
            });
            const res = await fetch(`/api/upload?${q.toString()}`, { method: 'DELETE' });
            if (!res.ok) {
                console.error('Не удалось удалить документ');
            } else {
                setTask((prev) =>
                    prev
                        ? {
                              ...prev,
                              documents: prev.documents?.filter((d) => d !== documentToDelete),
                              attachments: prev.attachments?.filter((a) => a !== documentToDelete),
                          }
                        : prev
                );
            }
        } catch (e) {
            console.error(e);
        } finally {
            setDocumentDeleting(false);
            setDeleteDocumentOpen(false);
            setDocumentToDelete(null);
        }
    };

    const sortedEvents = React.useMemo(() => {
        if (!task?.events) return [];

        // сначала отсортируем как было
        const raw = [...task.events].sort((a, b) => {
            const da = new Date(a.date).getTime();
            const db = new Date(b.date).getTime();
            return db - da;
        });

        const result: TaskEvent[] = [];

        for (const ev of raw) {
            // если это "назначена исполнителю" — попробуем найти пару updated с тем же временем
            if (ev.action === 'status_changed_assigned') {
                const pair = raw.find(
                    (p) =>
                        p.action === 'updated' &&
                        p.date === ev.date // у тебя они реально в один момент пишутся
                );

                if (pair && pair.details) {
                    // из updated достанем статус (from → to) и, на всякий случай, executorEmail
                    const mergedDetails: TaskEventDetails = {
                        ...(ev.details || {}),
                    };

                    // статус может быть в формате { status: { from, to } }
                    const st = pair.details.status;
                    if (
                        st &&
                        typeof st === 'object' &&
                        ('from' in st || 'to' in st)
                    ) {
                        mergedDetails.status = st as Change;
                    }

                    // executorEmail мог прийти в updated
                    if (pair.details.executorEmail && !mergedDetails.executorEmail) {
                        mergedDetails.executorEmail = pair.details.executorEmail as string;
                    }

                    result.push({
                        ...ev,
                        details: mergedDetails,
                    });

                    continue;
                }

                // если пары нет — просто кладём как есть
                result.push(ev);
                continue;
            }

            // если это updated, но у него есть "назначение исполнителя" с тем же временем — пропустим
            const hasAssignWithSameTime = raw.some(
                (p) => p.action === 'status_changed_assigned' && p.date === ev.date
            );
            if (ev.action === 'updated' && hasAssignWithSameTime) {
                // пропускаем избыточный updated
                continue;
            }

            result.push(ev);
        }

        return result;
    }, [task?.events]);


    const getEventTitle = (action: string, ev?: TaskEvent): string => {
        if (action === 'created') return 'Задача создана';
        if (action === 'status_changed_assigned') return 'Задача назначена исполнителю';
        if (action === 'updated' && ev && isExecutorRemovedEvent(ev)) {
            return 'Исполнитель снят с задачи';
        }
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

    const isExecutorRemovedEvent = (ev: TaskEvent): boolean => {
        if (ev.action !== 'updated') return false;
        const d = ev.details || {};

        // исполнителя могли снять по любому из этих полей
        const candidates = [d.executorId, d.executorName, d.executorEmail];

        const isRemovedChange = (val: unknown): val is { from?: unknown; to?: unknown } => {
            if (typeof val !== 'object' || val === null) return false;
            const obj = val as { from?: unknown; to?: unknown };
            // вариант 1: был to и он undefined
            if ('to' in obj && typeof obj.to === 'undefined') return true;
            // вариант 2: было только from (значит стало пусто)
            return 'from' in obj && !('to' in obj);
        };

        return candidates.some((c) => isRemovedChange(c));
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
        } else if (ev.action === 'status_changed_assigned') {
            const executorStr = getDetailString(d, 'executorName');
            const executorEmailStr = getDetailString(d, 'executorEmail');

            let statusLine: string | null = null;
            const maybeStatus = d.status;
            if (
                maybeStatus &&
                typeof maybeStatus === 'object' &&
                ('from' in (maybeStatus as Record<string, unknown>) ||
                    'to' in (maybeStatus as Record<string, unknown>))
            ) {
                const st = maybeStatus as { from?: unknown; to?: unknown };
                statusLine = `Статус: ${asText(st.from)} → ${asText(st.to)}`;
            }

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
                    {statusLine && (
                        <Typography variant="caption" display="block">
                            {statusLine}
                        </Typography>
                    )}
                </>
            );
        } else if (ev.action === 'updated') {
            // твоя логика updated как была
            if (isExecutorRemovedEvent(ev)) {
                const st = d.status;
                let statusLine: string | null = null;
                if (
                    st &&
                    typeof st === 'object' &&
                    ('from' in (st as Record<string, unknown>) || 'to' in (st as Record<string, unknown>))
                ) {
                    const ch = st as Change;
                    statusLine = `Статус: ${asText(ch.from)} → ${asText(ch.to)}`;
                }

                return (
                    <>
                        <Typography variant="caption" display="block">
                            Исполнитель: —
                        </Typography>
                        {statusLine && (
                            <Typography variant="caption" display="block">
                                {statusLine}
                            </Typography>
                        )}
                    </>
                );
            }

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

        // fallback
        return Object.entries(d).map(([key, value]) => (
            <Typography key={key} variant="caption" display="block">
                {key}: {value === null || typeof value === 'undefined' ? '—' : String(value)}
            </Typography>
        ));
    };

    const getEventAuthorLine = (ev: TaskEvent): string => {
        const detailEmail =
            ev.details && typeof ev.details.authorEmail === 'string'
                ? ev.details.authorEmail
                : undefined;
        const email = ev.authorEmail || detailEmail;
        if (email && ev.author) return `${ev.author} (${email})`;
        if (email) return email;
        return ev.author;
    };

    const renderWorkItemsTable = (maxHeight?: number | string) => {
        if (!hasWorkItems) {
            return (
                <Typography color="text.secondary" sx={{ px: 1 }}>
                    Нет данных
                </Typography>
            );
        }

        return (
            <Box
                sx={{
                    maxHeight: maxHeight ?? { xs: 320, md: 420 },
                    overflow: 'auto',
                }}
            >
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell>Вид работ</TableCell>
                            <TableCell>Кол-во</TableCell>
                            <TableCell>Ед.</TableCell>
                            <TableCell>Примечание</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {task.workItems?.map((item, idx) => (
                            <TableRow key={`work-${idx}`}>
                                <TableCell sx={{ minWidth: 180 }}>
                                    {item.workType || '—'}
                                </TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                    {item.quantity ?? '—'}
                                </TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                    {item.unit || '—'}
                                </TableCell>
                                <TableCell>{item.note || '—'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Box>
        );
    };

    const renderCommentsSection = (maxHeight?: number | string) => {
        const currentTask = task;
        if (!currentTask) return null;

        return (
            <Box
                sx={{
                    maxHeight: maxHeight ?? { xs: 360, md: 520 },
                    overflow: 'auto',
                }}
            >
                <TaskComments
                    taskId={currentTask.taskId || id}
                    initialComments={currentTask.comments}
                    onTaskUpdated={(updatedTask) =>
                        setTask((prev) =>
                            prev ? { ...prev, ...(updatedTask as Partial<Task>) } : prev
                        )
                    }
                />
            </Box>
        );
    };


    return (
        <Box
            sx={{
                px: { xs: 0.5, md: 1.5 },
                py: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
            }}
        >
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
                            {task?.status && (
                                <Chip
                                    label={task.status}
                                    size="small"
                                    sx={{
                                        bgcolor: getStatusColor(task.status),
                                        color: '#fff',
                                        fontWeight: 500,
                                    }}
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
                        columns={{ xs: 1, sm: 1, md: 2, lg: 3, xl: 4 }}
                        spacing={{ xs: 1, sm: 1.5, md: 2 }}
                        sx={{
                            '& > *': {
                                boxSizing: 'border-box',
                            },
                        }}
                    >
                        {/* Информация */}
                        <CardItem sx={{ minWidth: 0 }}>
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

                            <Stack spacing={1}>
                                {/* БС */}
                                <Typography variant="body1">
                                    <strong>Базовая станция:</strong> {task.bsNumber || '—'}
                                </Typography>

                                {/* Адрес */}
                                <Typography variant="body1">
                                    <strong>Адрес:</strong> {task.bsAddress || 'Адрес не указан'}
                                </Typography>

                                <Typography variant="body1">
                                    <strong>Срок:</strong>{' '}
                                    {task.dueDate ? formatDate(task.dueDate) : '—'}
                                </Typography>
                                <Typography
                                    variant="body1"
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.75,
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <strong>Приоритет:</strong>
                                    <Box
                                        component="span"
                                        sx={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                        }}
                                    >
                                        {getPriorityIcon(
                                            (normalizePriority(task.priority as string) ?? 'medium') as
                                                'urgent' | 'high' | 'medium' | 'low'
                                        )}
                                        <span>{task.priority || '—'}</span>
                                    </Box>
                                </Typography>

                                <Typography variant="body1">
                                    <strong>Стоимость:</strong> {formatPrice(task.totalCost)}
                                </Typography>
                                <Typography variant="body1">
                                    <strong>Тип задачи:</strong> {task.taskType || '—'}
                                </Typography>

                                {/* Исполнитель (если есть) */}
                                {(task.executorName || task.executorEmail) && (
                                    <Typography variant="body1">
                                        <strong>Исполнитель:</strong>{' '}
                                        {task.executorName || task.executorEmail}
                                    </Typography>
                                )}

                                {/* Создана + обновлена */}
                                <Box
                                    sx={{
                                        display: 'flex',
                                        gap: 3,
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        pt: 0.5,
                                    }}
                                >
                                    <Typography variant="body1">
                                        <strong>Создана:</strong>{' '}
                                        {task.createdAt ? formatDate(task.createdAt) : '—'}
                                    </Typography>
                                    <Typography variant="body1">
                                        <strong>Обновлена:</strong>{' '}
                                        {task.updatedAt ? formatDate(task.updatedAt) : '—'}
                                    </Typography>
                                </Box>
                            </Stack>
                        </CardItem>

                        {/* Описание */}
                        <CardItem sx={{ minWidth: 0 }}>
                            <Typography
                                variant="body1"
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
                                <Typography color="text.secondary">
                                    Нет описания
                                </Typography>
                            )}
                        </CardItem>

                        {/* Геолокация */}
                        <CardItem sx={{ minWidth: 0 }}>
                            <Box sx={{ lineHeight: 1.6 }}>
                                <Typography variant="body1">
                                <TaskGeoLocation locations={task.bsLocation} />
                                </Typography>
                            </Box>
                        </CardItem>

                        {/* Состав работ */}
                        {(hasWorkItems || Array.isArray(task.workItems)) && (
                            <CardItem
                                sx={(theme) => ({
                                    minWidth: 0,
                                    width: {
                                        xs: `calc(100% - ${theme.spacing(1)})`,
                                        sm: `calc(100% - ${theme.spacing(1.5)})`,
                                        md: `calc(100% - ${theme.spacing(2)})`,
                                        lg: `calc((100% / 3 * 2) - ${theme.spacing(2)})`,
                                        xl: `calc((100% / 4 * 2) - ${theme.spacing(2)})`,
                                    },
                                })}
                            >
                                <Accordion
                                    defaultExpanded
                                    disableGutters
                                    elevation={0}
                                    sx={{ '&:before': { display: 'none' } }}
                                >
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                width: '100%',
                                                gap: 1,
                                            }}
                                        >
                                            <Typography
                                                variant="subtitle1"
                                                fontWeight={600}
                                                gutterBottom
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                }}
                                            >
                                                <TocOutlinedIcon fontSize="small" />
                                                Состав работ
                                            </Typography>

                                            <Tooltip title="Развернуть на весь экран">
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setWorkItemsFullScreen(true);
                                                    }}
                                                >
                                                    <OpenInFullIcon fontSize="inherit" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </AccordionSummary>
                                    <AccordionDetails sx={{ pt: 0 }}>
                                        <Divider sx={{ mb: 1.5 }} />
                                        {renderWorkItemsTable()}
                                    </AccordionDetails>
                                </Accordion>
                            </CardItem>
                        )}

                        {/* Вложения — если есть */}
                        <CardItem sx={{ minWidth: 0 }}>
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
                            {hasAttachments ? (
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
                                    {attachmentLinks.map((url, idx) => (
                                        <Link
                                            key={`att-${idx}`}
                                            href={url}
                                            target="_blank"
                                            rel="noreferrer"
                                            underline="hover"
                                        >
                                            {extractFileNameFromUrl(url, `Вложение ${idx + 1}`)}
                                        </Link>
                                    ))}
                                </Stack>
                            ) : (
                                <Typography color="text.secondary">
                                    Нет вложений
                                </Typography>
                            )}
                        </CardItem>

                        {/* Документы */}
                        <CardItem sx={{ minWidth: 0 }}>
                            <Typography
                                variant="subtitle1"
                                fontWeight={600}
                                gutterBottom
                                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                            >
                                <ArticleOutlinedIcon fontSize="small" />
                                Документы
                            </Typography>
                            <Divider sx={{ mb: 1.5 }} />
                            {hasDocuments ? (
                                <Stack gap={1}>
                                    {documentLinks.map((url, idx) => {
                                        const isEstimate = idx === 0;
                                        const label = isEstimate
                                            ? `Смета — ${extractFileNameFromUrl(url, 'Смета')}`
                                            : extractFileNameFromUrl(url, `Документ ${idx + 1}`);
                                        const isCurrentDeleting = documentDeleting && documentToDelete === url;

                                        return (
                                            <Box
                                                key={`doc-${idx}`}
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                {isEstimate && (
                                                    <>
                                                        <Tooltip title="Скачать смету">
                                                            <span>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => void handleDownloadDocument(url)}
                                                                    disabled={isCurrentDeleting}
                                                                >
                                                                    <DownloadOutlinedIcon fontSize="small" />
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                        <Tooltip title="Удалить смету">
                                                            <span>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => openDeleteDocumentDialog(url)}
                                                                    disabled={isCurrentDeleting}
                                                                >
                                                                    {isCurrentDeleting ? (
                                                                        <CircularProgress size={18} />
                                                                    ) : (
                                                                        <DeleteOutlineIcon fontSize="small" />
                                                                    )}
                                                                </IconButton>
                                                            </span>
                                                        </Tooltip>
                                                    </>
                                                )}
                                                <Link
                                                    href={url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    underline="hover"
                                                >
                                                    {label}
                                                </Link>
                                            </Box>
                                        );
                                    })}
                                </Stack>
                            ) : (
                                <Typography color="text.secondary">Документы отсутствуют</Typography>
                            )}
                        </CardItem>

                        {/* Комментарии */}
                        <CardItem sx={{ minWidth: 0 }}>
                            <Accordion
                                defaultExpanded={!!task?.comments?.length}
                                disableGutters
                                elevation={0}
                                sx={{ '&:before': { display: 'none' } }}
                            >
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            width: '100%',
                                            gap: 1,
                                        }}
                                    >
                                        <Typography
                                            variant="subtitle1"
                                            fontWeight={600}
                                            gutterBottom
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                            }}
                                        >
                                            <CommentOutlinedIcon fontSize="small" />
                                            Комментарии
                                        </Typography>

                                        <Tooltip title="Развернуть на весь экран">
                                            <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setCommentsFullScreen(true);
                                                }}
                                            >
                                                <OpenInFullIcon fontSize="inherit" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={{ pt: 0 }}>
                                    <Divider sx={{ mb: 1.5 }} />
                                    {renderCommentsSection()}
                                </AccordionDetails>
                            </Accordion>
                        </CardItem>

                        {/* История */}
                        <CardItem sx={{ p: 0, minWidth: 0 }}>
                            <Accordion
                                disableGutters
                                elevation={0}
                                sx={{ '&:before': { display: 'none' } }}
                            >
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography
                                        variant="subtitle1"
                                        fontWeight={600}
                                        gutterBottom
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                        }}
                                    >
                                        <HistoryIcon fontSize="small" />
                                        История
                                    </Typography>
                                </AccordionSummary>
                                <AccordionDetails sx={{ pt: 0 }}>
                                    <Divider sx={{ mb: 1.5 }} />
                                    {sortedEvents.length === 0 ? (
                                        <Typography
                                            color="text.secondary"
                                            sx={{ px: 2, pb: 1.5 }}
                                        >
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
                                                        <Typography
                                                            variant="caption"
                                                            color="text.secondary"
                                                        >
                                                            {formatDateTime(ev.date)}
                                                        </Typography>
                                                    </TimelineOppositeContent>
                                                    <TimelineSeparator>
                                                        <TimelineDot
                                                            color={
                                                                ev.action === 'created'
                                                                    ? 'primary'
                                                                    : 'success'
                                                            }
                                                        />
                                                        {idx <
                                                            sortedEvents.length - 1 && (
                                                                <TimelineConnector />
                                                            )}
                                                    </TimelineSeparator>
                                                    <TimelineContent
                                                        sx={{ py: 1, minWidth: 0 }}
                                                    >
                                                        <Typography
                                                            variant="body2"
                                                            fontWeight={600}
                                                        >
                                                            {getEventTitle(ev.action, ev)}
                                                        </Typography>
                                                        <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                        >
                                                            Автор:{' '}
                                                            {getEventAuthorLine(ev)}
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
                        </CardItem>

                        {/* Заказ / договор — если есть */}
                        {(task.orderNumber ||
                            task.orderUrl ||
                            task.orderDate ||
                            task.orderSignDate) && (
                            <CardItem sx={{ minWidth: 0 }}>
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                    gutterBottom
                                >
                                    Заказ / договор
                                </Typography>
                                <Divider sx={{ mb: 1.5 }} />
                                <Stack gap={0.5}>
                                    {task.orderNumber && (
                                        <Typography>
                                            Номер: {task.orderNumber}
                                        </Typography>
                                    )}
                                    {task.orderDate && (
                                        <Typography>
                                            Дата заказа:{' '}
                                            {formatDate(task.orderDate)}
                                        </Typography>
                                    )}
                                    {task.orderSignDate && (
                                        <Typography>
                                            Дата подписания:{' '}
                                            {formatDate(task.orderSignDate)}
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
                            </CardItem>
                        )}
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

            <Dialog
                fullScreen
                open={workItemsFullScreen}
                onClose={() => setWorkItemsFullScreen(false)}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 2,
                        borderBottom: 1,
                        borderColor: 'divider',
                    }}
                >
                    <Typography variant="h6" fontWeight={600}>
                        Состав работ
                    </Typography>
                    <IconButton onClick={() => setWorkItemsFullScreen(false)}>
                        <CloseFullscreenIcon />
                    </IconButton>
                </Box>

                <Box sx={{ p: 2 }}>
                    {renderWorkItemsTable('calc(100vh - 80px)')}
                </Box>
            </Dialog>

            <Dialog
                fullScreen
                open={commentsFullScreen}
                onClose={() => setCommentsFullScreen(false)}
            >
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 2,
                        borderBottom: 1,
                        borderColor: 'divider',
                    }}
                >
                    <Typography variant="h6" fontWeight={600}>
                        Комментарии
                    </Typography>
                    <IconButton onClick={() => setCommentsFullScreen(false)}>
                        <CloseFullscreenIcon />
                    </IconButton>
                </Box>

                <Box sx={{ p: 2 }}>
                    {renderCommentsSection('calc(100vh - 80px)')}
                </Box>
            </Dialog>

            <Dialog
                open={deleteDocumentOpen}
                onClose={closeDeleteDocumentDialog}
            >
                <DialogTitle>Удалить смету?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Файл сметы будет удалён из задачи.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeDeleteDocumentDialog} disabled={documentDeleting}>
                        Отмена
                    </Button>
                    <Button
                        onClick={confirmDeleteDocument}
                        color="error"
                        variant="contained"
                        disabled={documentDeleting}
                        startIcon={
                            documentDeleting ? <CircularProgress size={18} color="inherit" /> : null
                        }
                    >
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>

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

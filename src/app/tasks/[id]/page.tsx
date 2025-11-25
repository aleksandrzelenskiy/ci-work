// app/tasks/[id]/page.tsx

'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    IconButton,
    Link,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CommentOutlinedIcon from '@mui/icons-material/CommentOutlined';
import TocOutlinedIcon from '@mui/icons-material/TocOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import HistoryIcon from '@mui/icons-material/History';
import {
    Timeline,
    TimelineConnector,
    TimelineContent,
    TimelineDot,
    TimelineItem,
    TimelineOppositeContent,
    TimelineSeparator,
} from '@mui/lab';
import Masonry from '@mui/lab/Masonry';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import { FINANCE_CONFIG } from '@/config/finance';
import { getPriorityIcon, normalizePriority } from '@/utils/priorityIcons';
import TaskGeoLocation from '@/app/workspace/components/TaskGeoLocation';
import { getStatusColor } from '@/utils/statusColors';
import { getStatusLabel, normalizeStatusTitle } from '@/utils/statusLabels';
import TaskComments, { type TaskComment } from '@/app/components/TaskComments';
import { fetchUserContext, resolveRoleFromContext } from '@/app/utils/userContext';
import type { EffectiveOrgRole } from '@/app/types/roles';
import { isAdminRole, isExecutorRole } from '@/app/utils/roleGuards';
import type { Task, WorkItem, TaskEvent } from '@/app/types/taskTypes';
import { extractFileNameFromUrl, isDocumentUrl } from '@/utils/taskFiles';

type LoadedRole = EffectiveOrgRole | null;

const CardItem = styled(Paper)(({ theme }) => ({
    backgroundColor: '#fff',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[3],
    ...theme.applyStyles?.('dark', {
        backgroundColor: '#1A2027',
    }),
}));

const parseUserInfo = (userString?: string) => {
    if (!userString) return { name: 'N/A', email: 'N/A' };
    const cleanedString = userString.replace(/\)$/, '');
    const parts = cleanedString.split(' (');
    return { name: parts[0] || 'N/A', email: parts[1] || 'N/A' };
};

export default function TaskDetailPage() {
    const params = useParams<{ id: string }>();
    const taskId = params?.id?.trim() || '';
    const router = useRouter();

    const [task, setTask] = React.useState<Task | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [userRole, setUserRole] = React.useState<LoadedRole>(null);
    const [workItemsFullScreen, setWorkItemsFullScreen] = React.useState(false);
    const [commentsFullScreen, setCommentsFullScreen] = React.useState(false);
    const [pendingDecision, setPendingDecision] = React.useState<'accept' | 'reject' | null>(null);
    const [decisionLoading, setDecisionLoading] = React.useState(false);
    const [decisionError, setDecisionError] = React.useState<string | null>(null);

    const roleLoaded = userRole !== null;
    const isExecutor = isExecutorRole(userRole);
    const isAdmin = isAdminRole(userRole);

    const formatDate = (v?: string | Date) => {
        if (!v) return '—';
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return String(v);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}.${mm}.${yyyy}`;
    };

    const formatDateTime = (v?: string | Date) => {
        if (!v) return '—';
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) return String(v);
        return d.toLocaleString('ru-RU');
    };

    const formatRuble = (value?: number) => {
        if (typeof value !== 'number') return '—';
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value) + ' ₽';
    };

    const renderCost = () => {
        if (typeof task?.totalCost !== 'number') return '—';

        const total = task.totalCost;
        const commission = total * FINANCE_CONFIG.COMMISSION_PERCENT;
        const sumToPay = total * FINANCE_CONFIG.SUM_TO_PAY_PERCENT;
        const tax = (total * (1 - FINANCE_CONFIG.COMMISSION_PERCENT)) * FINANCE_CONFIG.TAX_PERCENT_OF_REMAINING;
        const profit = total - (commission + sumToPay + tax);

        if (!roleLoaded) return formatRuble(total);
        if (isExecutor) return formatRuble(sumToPay);
        if (isAdmin) {
            return (
                <Tooltip
                    title={
                        <Box sx={{ p: 1 }}>
                            <Typography variant="body2">
                                <strong>Комиссия:</strong> {formatRuble(commission)}
                            </Typography>
                            <Typography variant="body2">
                                <strong>Налоги:</strong> {formatRuble(tax)}
                            </Typography>
                            <Typography variant="body2">
                                <strong>Выплата исполнителю:</strong> {formatRuble(sumToPay)}
                            </Typography>
                            <Typography variant="body2">
                                <strong>Прибыль:</strong> {formatRuble(profit)}
                            </Typography>
                        </Box>
                    }
                    arrow
                    placement="top"
                >
                    <Box
                        component="span"
                        sx={{
                            cursor: 'help',
                            borderBottom: '1px dotted',
                            borderColor: 'text.secondary',
                        }}
                    >
                        {formatRuble(total)}
                    </Box>
                </Tooltip>
            );
        }

        return formatRuble(total);
    };

    const asText = (x: unknown): string => {
        if (x === null || typeof x === 'undefined') return '—';
        if (typeof x === 'string') {
            const d = new Date(x);
            if (!Number.isNaN(d.getTime())) return d.toLocaleString('ru-RU');
        }
        return String(x);
    };

    const loadTask = React.useCallback(async () => {
        if (!taskId) return;
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
                cache: 'no-store',
            });
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
    }, [taskId]);

    React.useEffect(() => {
        const fetchUserRole = async () => {
            try {
                const ctx = await fetchUserContext();
                const resolvedRole = resolveRoleFromContext(ctx);
                setUserRole(resolvedRole ?? 'executor');
            } catch {
                setUserRole('executor');
            }
        };
        void fetchUserRole();
    }, []);

    React.useEffect(() => {
        void loadTask();
    }, [loadTask]);

    const hasWorkItems = Array.isArray(task?.workItems) && task.workItems.length > 0;
    const attachmentLinks = React.useMemo(
        () => (Array.isArray(task?.attachments) ? task.attachments.filter((url) => !isDocumentUrl(url)) : []),
        [task]
    );

    const hasAttachments = attachmentLinks.length > 0;

    const sortedEvents = React.useMemo(() => {
        if (!task?.events) return [];
        return [...task.events].sort((a, b) => {
            const da = new Date(a.date).getTime();
            const db = new Date(b.date).getTime();
            return db - da;
        });
    }, [task?.events]);

    const getEventTitle = (action: string) => {
        if (action === 'TASK_CREATED') return 'Задача создана';
        if (action === 'STATUS_CHANGED') return 'Статус изменен';
        return action;
    };

    const renderEventDetails = (ev: TaskEvent) => {
        if (ev.action === 'STATUS_CHANGED' && ev.details) {
            const oldStatus = 'oldStatus' in ev.details ? ev.details.oldStatus : undefined;
            const newStatus = 'newStatus' in ev.details ? ev.details.newStatus : undefined;
            return (
                <Typography variant="caption" display="block">
                    {oldStatus ? `Статус: ${oldStatus}` : 'Статус'} → {asText(newStatus)}
                </Typography>
            );
        }

        if (ev.details?.comment) {
            return (
                <Typography variant="caption" display="block">
                    {ev.details.comment}
                </Typography>
            );
        }

        return null;
    };

    const getEventAuthorLine = (ev: TaskEvent): string => {
        const parsed = parseUserInfo(ev.author);
        if (parsed.email && parsed.email !== 'N/A') return `${parsed.name} (${parsed.email})`;
        return parsed.name;
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
                        {task?.workItems?.map((item: WorkItem, idx) => (
                            <TableRow key={`work-${idx}`}>
                                <TableCell sx={{ minWidth: 180 }}>{item.workType || '—'}</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                    {Number.isFinite(item.quantity) ? item.quantity : '—'}
                                </TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{item.unit || '—'}</TableCell>
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
                    taskId={currentTask.taskId || taskId}
                    initialComments={currentTask.comments as TaskComment[]}
                    onTaskUpdated={(updatedTask) =>
                        setTask((prev) => (prev ? { ...prev, ...(updatedTask as Partial<Task>) } : prev))
                    }
                />
            </Box>
        );
    };

    const closeDecisionDialog = () => {
        if (decisionLoading) return;
        setPendingDecision(null);
        setDecisionError(null);
    };

    const handleDecisionConfirm = async () => {
        if (!pendingDecision) return;
        if (!taskId) {
            setDecisionError('Не найден идентификатор задачи');
            return;
        }
        setDecisionLoading(true);
        setDecisionError(null);
        try {
            const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ decision: pendingDecision }),
            });
            const data = (await res.json()) as { task?: Task; error?: string };
            if (!res.ok || !data.task) {
                setDecisionError(data.error || 'Не удалось обновить задачу');
                return;
            }

            setTask((prev) => {
                const updated = data.task as Task;
                return prev ? { ...prev, ...updated } : updated;
            });
            setPendingDecision(null);
        } catch (e) {
            setDecisionError(e instanceof Error ? e.message : 'Неизвестная ошибка');
        } finally {
            setDecisionLoading(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="error" gutterBottom>
                    {error}
                </Typography>
                <Button
                    variant="outlined"
                    onClick={() => void loadTask()}
                    startIcon={<RefreshIcon />}
                >
                    Повторить
                </Button>
            </Box>
        );
    }

    if (!task) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography gutterBottom>Задача не найдена</Typography>
                <Button
                    variant="text"
                    onClick={() => router.push('/tasks')}
                    startIcon={<ArrowBackIcon />}
                >
                    К списку задач
                </Button>
            </Box>
        );
    }

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
                                {task.taskName || 'Задача'}
                            </Typography>
                            {task.bsNumber && <Typography variant="h6">{task.bsNumber}</Typography>}

                            {task.taskId && (
                                <Chip
                                    label={task.taskId}
                                    size="small"
                                    variant="outlined"
                                    sx={{ mt: 0.5 }}
                                />
                            )}
                            {task.status && (
                                <Chip
                                    label={getStatusLabel(task.status)}
                                    size="small"
                                    sx={{
                                        bgcolor: getStatusColor(normalizeStatusTitle(task.status)),
                                        color: '#fff',
                                        fontWeight: 500,
                                    }}
                                />
                            )}
                        </Stack>

                        {(task.projectName || task.projectKey) && (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}
                            >
                                Проект:{' '}
                                {task.projectKey && task.orgId ? (
                                    <Link
                                        href={`/org/${encodeURIComponent(task.orgId ?? '')}/projects/${encodeURIComponent(
                                            task.projectKey
                                        )}/tasks`}
                                        underline="hover"
                                        color="inherit"
                                    >
                                        {task.projectName || task.projectKey}
                                    </Link>
                                ) : (
                                    task.projectName || task.projectKey
                                )}
                            </Typography>
                        )}

                    </Box>
                </Stack>
                <Stack direction="row" spacing={1}>
                    <Tooltip title="Обновить">
                        <span>
                            <IconButton onClick={() => void loadTask()} disabled={loading}>
                                <RefreshIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
            </Stack>

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
                            <Typography variant="body1">
                                <strong>Базовая станция:</strong> {task.bsNumber || '—'}
                            </Typography>

                            <Typography variant="body1">
                                <strong>Адрес:</strong> {task.bsAddress || 'Адрес не указан'}
                            </Typography>

                            <Typography variant="body1">
                                <strong>Срок:</strong> {task.dueDate ? formatDate(task.dueDate) : '—'}
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
                                <strong>Стоимость:</strong> {renderCost()}
                            </Typography>
                            <Typography variant="body1">
                                <strong>Тип задачи:</strong> {task.taskType || '—'}
                            </Typography>

                            {(task.executorName || task.executorEmail) && (
                                <Typography variant="body1">
                                    <strong>Исполнитель:</strong> {task.executorName || task.executorEmail}
                                </Typography>
                            )}

                            <Typography variant="body1">
                                <strong>Инициатор:</strong> {parseUserInfo(task.initiatorName).name}
                            </Typography>

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
                            </Box>

                            <Divider sx={{ mt: 1.5, mb: 1 }} />
                            <Stack spacing={1}>
                                <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={1.5}
                                    alignItems={{ xs: 'stretch', sm: 'center' }}
                                    justifyContent="flex-start"
                                >
                                    <Button
                                        variant="contained"
                                        onClick={() => {
                                            setDecisionError(null);
                                            setPendingDecision('accept');
                                        }}
                                        disabled={decisionLoading || task.status === 'At work'}
                                        sx={{
                                            borderRadius: 999,
                                            textTransform: 'none',
                                            px: 2.75,
                                            py: 1.1,
                                            fontWeight: 700,
                                            background: 'linear-gradient(135deg, #2fd66b, #1ecf5a)',
                                            boxShadow: '0 10px 28px rgba(38, 189, 104, 0.35)',
                                            color: '#0b2916',
                                            '&:hover': {
                                                background: 'linear-gradient(135deg, #29c961, #1abf51)',
                                            },
                                        }}
                                    >
                                        Принять
                                    </Button>
                                    <Button
                                        variant="contained"
                                        onClick={() => {
                                            setDecisionError(null);
                                            setPendingDecision('reject');
                                        }}
                                        disabled={decisionLoading || task.status === 'To do'}
                                        sx={{
                                            borderRadius: 999,
                                            textTransform: 'none',
                                            px: 2.75,
                                            py: 1.1,
                                            fontWeight: 700,
                                            background: 'linear-gradient(135deg, #f4f6fa, #e8ebf1)',
                                            boxShadow: '0 8px 22px rgba(15, 16, 20, 0.12)',
                                            color: '#0f1115',
                                            border: '1px solid rgba(0,0,0,0.06)',
                                            '&:hover': {
                                                background: 'linear-gradient(135deg, #e6e9ef, #d9dce4)',
                                            },
                                        }}
                                    >
                                        Отказать
                                    </Button>
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                    Статус после принятия: At work. После отказа: To do.
                                </Typography>
                            </Stack>
                        </Stack>
                    </CardItem>

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
                            <Typography sx={{ whiteSpace: 'pre-wrap' }}>{task.taskDescription}</Typography>
                        ) : (
                            <Typography color="text.secondary">Нет описания</Typography>
                        )}
                    </CardItem>

                    <CardItem sx={{ minWidth: 0 }}>
                        <TaskGeoLocation locations={task.bsLocation} />
                    </CardItem>

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
                        {hasAttachments || task.reportLink ? (
                            <Stack gap={1}>
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
                                {task.reportLink && (
                                    <Button
                                        href={task.reportLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        variant="text"
                                        sx={{ alignSelf: 'flex-start' }}
                                    >
                                        Отчет по задаче
                                    </Button>
                                )}
                            </Stack>
                        ) : (
                            <Typography color="text.secondary">Нет вложений</Typography>
                        )}
                    </CardItem>

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

                    <CardItem sx={{ p: 0, minWidth: 0 }}>
                        <Accordion disableGutters elevation={0} sx={{ '&:before': { display: 'none' } }}>
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
                                            <TimelineItem key={ev._id ?? idx}>
                                                <TimelineOppositeContent sx={{ pr: 1 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {formatDateTime(ev.date)}
                                                    </Typography>
                                                </TimelineOppositeContent>
                                                <TimelineSeparator>
                                                    <TimelineDot
                                                        color={ev.action === 'TASK_CREATED' ? 'primary' : 'success'}
                                                    />
                                                    {idx < sortedEvents.length - 1 && <TimelineConnector />}
                                                </TimelineSeparator>
                                                <TimelineContent sx={{ py: 1, minWidth: 0 }}>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {getEventTitle(ev.action)}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        Автор: {getEventAuthorLine(ev)}
                                                    </Typography>
                                                    <Box sx={{ mt: 0.5 }}>{renderEventDetails(ev)}</Box>
                                                </TimelineContent>
                                            </TimelineItem>
                                        ))}
                                    </Timeline>
                                )}
                            </AccordionDetails>
                        </Accordion>
                    </CardItem>

                    {(task.orderNumber || task.orderUrl || task.orderDate || task.orderSignDate) && (
                        <CardItem sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                Заказ / договор
                            </Typography>
                            <Divider sx={{ mb: 1.5 }} />
                            <Stack gap={0.5}>
                                {task.orderNumber && <Typography>Номер: {task.orderNumber}</Typography>}
                                {task.orderDate && <Typography>Дата заказа: {formatDate(task.orderDate)}</Typography>}
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
                        </CardItem>
                    )}
                </Masonry>
            </Box>

            <Dialog
                open={!!pendingDecision}
                onClose={closeDecisionDialog}
                slotProps={{
                    paper: {
                        sx: {
                            borderRadius: 4,
                            background:
                                'linear-gradient(160deg, rgba(255,255,255,0.92), rgba(244,247,252,0.94))',
                            border: '1px solid rgba(255,255,255,0.6)',
                            boxShadow: '0 30px 80px rgba(12, 16, 29, 0.28)',
                            backdropFilter: 'blur(18px)',
                            minWidth: { xs: 'calc(100% - 32px)', sm: 420 },
                        },
                    },
                }}
            >
                <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>
                    {pendingDecision === 'accept' ? 'Принять задачу' : 'Отказаться от задачи'}
                </DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <Typography variant="body1" sx={{ mb: 1.5 }}>
                        {pendingDecision === 'accept'
                            ? `Вы подтверждаете что готовы принять задачу ${task.taskName} ${task.bsNumber || ''}? Срок выполнение - ${
                                  task.dueDate ? formatDate(task.dueDate) : '—'
                              }.`
                            : `Вы уверены что хотите отказаться от задачи ${task.taskName} ${task.bsNumber || ''}?`}
                    </Typography>
                    {decisionError && (
                        <Typography variant="body2" color="error" fontWeight={600}>
                            {decisionError}
                        </Typography>
                    )}
                </DialogContent>
                <DialogActions
                    sx={{
                        px: 3,
                        pb: 2.5,
                        display: 'flex',
                        gap: 1,
                        justifyContent: 'flex-end',
                    }}
                >
                    <Button
                        onClick={closeDecisionDialog}
                        disabled={decisionLoading}
                        sx={{
                            textTransform: 'none',
                            borderRadius: 999,
                            px: 2.25,
                            py: 1,
                            color: '#111',
                            background: 'rgba(17,17,17,0.06)',
                            '&:hover': {
                                background: 'rgba(17,17,17,0.1)',
                            },
                        }}
                    >
                        Отмена
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => void handleDecisionConfirm()}
                        disabled={decisionLoading}
                        sx={{
                            textTransform: 'none',
                            borderRadius: 999,
                            px: 2.75,
                            py: 1,
                            fontWeight: 700,
                            background:
                                pendingDecision === 'accept'
                                    ? 'linear-gradient(135deg, #2fd66b, #1ecf5a)'
                                    : 'linear-gradient(135deg, #f04343, #d33131)',
                            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.18)',
                            color: pendingDecision === 'accept' ? '#0c2d18' : '#fff',
                            '&:hover': {
                                background:
                                    pendingDecision === 'accept'
                                        ? 'linear-gradient(135deg, #29c961, #1abf51)'
                                        : 'linear-gradient(135deg, #db3c3c, #c12b2b)',
                            },
                        }}
                    >
                        {decisionLoading
                            ? 'Сохранение...'
                            : pendingDecision === 'accept'
                              ? 'Принять'
                              : 'Отказать'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog fullScreen open={workItemsFullScreen} onClose={() => setWorkItemsFullScreen(false)}>
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

                <Box sx={{ p: 2 }}>{renderWorkItemsTable('calc(100vh - 80px)')}</Box>
            </Dialog>

            <Dialog fullScreen open={commentsFullScreen} onClose={() => setCommentsFullScreen(false)}>
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

                <Box sx={{ p: 2 }}>{renderCommentsSection('calc(100vh - 80px)')}</Box>
            </Dialog>
        </Box>
    );
}

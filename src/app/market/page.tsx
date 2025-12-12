// src/app/market/page.tsx
'use client';

import { useEffect, useState } from 'react';
import {
    Box,
    Container,
    Grid,
    Paper,
    Stack,
    Typography,
    Chip,
    TextField,
    InputAdornment,
    IconButton,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Alert,
    Snackbar,
    Divider,
    Tooltip,
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
import Masonry from '@mui/lab/Masonry';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import SendIcon from '@mui/icons-material/Send';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import TocOutlinedIcon from '@mui/icons-material/TocOutlined';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import type { PublicTaskStatus, TaskVisibility } from '@/app/types/taskTypes';
import type { PriorityLevel, TaskType } from '@/app/types/taskTypes';
import type { TaskApplication } from '@/app/types/application';
import MarketLocations from '@/app/components/MarketLocations';
import { REGION_MAP } from '@/app/utils/regions';
import { getPriorityLabelRu } from '@/utils/priorityIcons';

type PublicTask = {
    _id: string;
    taskName: string;
    bsNumber?: string;
    orgId?: string;
    orgSlug?: string;
    orgName?: string;
    taskDescription?: string;
    budget?: number;
    currency?: string;
    skills?: string[];
    bsAddress?: string;
    bsLocation?: { name?: string; coordinates?: string; address?: string }[];
    dueDate?: string;
    priority?: PriorityLevel;
    taskType?: TaskType;
    attachments?: string[];
    workItems?: { workType?: string; quantity?: number; unit?: string; note?: string }[];
    publicDescription?: string;
    publicStatus?: PublicTaskStatus;
    visibility?: TaskVisibility;
    applicationCount?: number;
    project?: {
        name?: string;
        key?: string;
        regionCode?: string;
        operator?: string;
    };
    myApplication?: Pick<TaskApplication, '_id' | 'status' | 'proposedBudget' | 'etaDays' | 'coverMessage'> | null;
    createdAt?: string;
};

type TaskResponse = { tasks?: PublicTask[]; error?: string };

type UserContext = {
    profileType?: 'employer' | 'contractor';
    name?: string;
    email?: string;
    user?: { _id?: string };
};

const gradientBg = (theme: { palette: { mode: string } }) =>
    theme.palette.mode === 'dark'
        ? 'linear-gradient(145deg, #0b0d12 0%, #0f1420 50%, #090c12 100%)'
        : 'linear-gradient(145deg, #f5f7fb 0%, #e8ecf6 55%, #f8fafc 100%)';

const glassPaperStyles = (theme: { palette: { mode: string } }) => ({
    p: 3,
    borderRadius: 3,
    border: '1px solid',
    borderColor:
        theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(15,23,42,0.08)',
    background:
        theme.palette.mode === 'dark'
            ? 'rgba(13,17,26,0.8)'
            : 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(18px)',
    boxShadow:
        theme.palette.mode === 'dark'
            ? '0 30px 90px rgba(0,0,0,0.55)'
            : '0 30px 90px rgba(15,23,42,0.08)',
});

const statusChipMap: Record<PublicTaskStatus, { label: string; color: 'default' | 'success' | 'warning' }> = {
    open: { label: 'Открыта', color: 'success' },
    in_review: { label: 'На рассмотрении', color: 'warning' },
    assigned: { label: 'Назначена', color: 'default' },
    closed: { label: 'Закрыта', color: 'default' },
};

const CardItem = styled(Paper)(({ theme }) => ({
    backgroundColor: '#fff',
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[3],
    ...theme.applyStyles?.('dark', {
        backgroundColor: '#1A2027',
    }),
}));

function formatBudget(budget?: number, currency?: string) {
    if (!budget || budget <= 0) return 'Бюджет не указан';
    const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
    const code = currency || 'RUB';
    return `${fmt.format(budget)} ${code}`;
}

function getRegionLabel(code?: string) {
    if (!code) return '';
    const region = REGION_MAP.get(code) || REGION_MAP.get(code.toUpperCase());
    return region?.label || '';
}

function formatDateRu(dateInput?: string) {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

function getTaskTypeLabel(taskType?: TaskType) {
    switch (taskType) {
        case 'construction':
            return 'Строительная';
        case 'installation':
            return 'Инсталляционная';
        case 'document':
            return 'Документальная';
        default:
            return 'Не указан';
    }
}

export default function MarketplacePage() {
    const [tasks, setTasks] = useState<PublicTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [selectedTask, setSelectedTask] = useState<PublicTask | null>(null);
    const [detailsTask, setDetailsTask] = useState<PublicTask | null>(null);
    const [workItemsFullScreen, setWorkItemsFullScreen] = useState(false);
    const [mapOpen, setMapOpen] = useState(false);
    const [applyMessage, setApplyMessage] = useState('');
    const [applyBudget, setApplyBudget] = useState('');
    const [applyEta, setApplyEta] = useState('');
    const [submitLoading, setSubmitLoading] = useState(false);
    const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);
    const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false,
        message: '',
        severity: 'success',
    });
    const [userContext, setUserContext] = useState<UserContext | null>(null);
    const [contextError, setContextError] = useState<string | null>(null);

    const handleOpenMapInfo = (task: PublicTask) => {
        setMapOpen(false);
        setDetailsTask(task);
    };

    const handleOpenMapApply = (task: PublicTask) => {
        setMapOpen(false);
        setSelectedTask(task);
    };

    const fetchTasks = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set('q', search.trim());
            const query = params.toString();
            const res = await fetch(query ? `/api/tasks/public?${query}` : '/api/tasks/public');
            const data: TaskResponse = await res.json();
            if (!res.ok || data.error) {
                setError(data.error || 'Не удалось загрузить задачи');
                setTasks([]);
            } else {
                setTasks(data.tasks || []);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка загрузки задач');
            setTasks([]);
        } finally {
            setLoading(false);
        }
    };

    const handleWithdrawApplication = async (task: PublicTask) => {
        const applicationId = task.myApplication?._id;
        if (!applicationId) return;

        setCancelLoadingId(applicationId);

        try {
            const res = await fetch(`/api/tasks/${task._id}/applications`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applicationId }),
            });
            const data = (await res.json().catch(() => ({}))) as { error?: string };

            if (!res.ok || data.error) {
                setSnack({
                    open: true,
                    message: data.error || 'Не удалось отменить отклик',
                    severity: 'error',
                });
                return;
            }

            setTasks((prev) =>
                prev.map((t) =>
                    t._id === task._id
                        ? {
                              ...t,
                              myApplication: null,
                              applicationCount: Math.max((t.applicationCount ?? 1) - 1, 0),
                          }
                        : t
                )
            );

            setSnack({
                open: true,
                message: 'Отклик удалён',
                severity: 'success',
            });
        } catch (e) {
            setSnack({
                open: true,
                message: e instanceof Error ? e.message : 'Ошибка при удалении',
                severity: 'error',
            });
        } finally {
            setCancelLoadingId(null);
        }
    };

    const fetchUser = async () => {
        try {
            const res = await fetch('/api/current-user', { cache: 'no-store' });
            const data: UserContext & { error?: string } = await res.json();
            if (!res.ok) {
                setContextError(data.error || 'Не удалось получить профиль');
                setUserContext(null);
                return;
            }
            setUserContext(data);
            setContextError(null);
        } catch (e) {
            setContextError(e instanceof Error ? e.message : 'Ошибка профиля');
            setUserContext(null);
        }
    };

    useEffect(() => {
        void fetchTasks();
        void fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedTask) {
            const draftBudget =
                selectedTask.budget && selectedTask.budget > 0
                    ? String(selectedTask.budget)
                    : '';
            setApplyBudget(draftBudget);
            setApplyEta('');
            setApplyMessage('');
        } else {
            setApplyBudget('');
            setApplyEta('');
            setApplyMessage('');
        }
    }, [selectedTask]);

    const handleSubmitApplication = async () => {
        if (!selectedTask?._id) return;
        if (userContext?.profileType !== 'contractor') {
            setSnack({
                open: true,
                message: 'Отклики доступны только подрядчикам',
                severity: 'error',
            });
            return;
        }
        const budgetValue = Number(applyBudget);
        if (!budgetValue || Number.isNaN(budgetValue) || budgetValue <= 0) {
            setSnack({ open: true, message: 'Укажите фиксированную ставку', severity: 'error' });
            return;
        }
        if (!applyMessage.trim()) {
            setSnack({ open: true, message: 'Добавьте сопроводительное сообщение', severity: 'error' });
            return;
        }
        setSubmitLoading(true);
        try {
            const res = await fetch(`/api/tasks/${selectedTask._id}/applications`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    coverMessage: applyMessage,
                    proposedBudget: budgetValue,
                    etaDays: applyEta ? Number(applyEta) : undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                setSnack({ open: true, message: data.error || 'Не удалось отправить отклик', severity: 'error' });
                return;
            }
            setSnack({ open: true, message: 'Отклик отправлен', severity: 'success' });
            setSelectedTask(null);
            setApplyMessage('');
            setApplyBudget('');
            setApplyEta('');
            void fetchTasks();
        } catch (e) {
            setSnack({
                open: true,
                message: e instanceof Error ? e.message : 'Ошибка при отправке',
                severity: 'error',
            });
        } finally {
            setSubmitLoading(false);
        }
    };

    const hasDetailsWorkItems = Boolean(detailsTask?.workItems && detailsTask.workItems.length > 0);

    const renderWorkItemsTable = (maxHeight?: number | string) => {
        if (!hasDetailsWorkItems || !detailsTask?.workItems) {
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
                        {detailsTask.workItems.map((item, idx) => (
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

    const hero = (
        <Box
            sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 4,
                px: { xs: 2, md: 5 },
                py: { xs: 3, md: 5 },
                mb: 4,
                background: (theme) =>
                    theme.palette.mode === 'dark'
                        ? 'linear-gradient(135deg, rgba(46,74,255,0.24), rgba(99,102,241,0.24))'
                        : 'linear-gradient(135deg, rgba(15,23,42,0.08), rgba(88,114,255,0.08))',
                border: '1px solid',
                borderColor: (theme) =>
                    theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(15,23,42,0.08)',
                boxShadow: (theme) =>
                    theme.palette.mode === 'dark'
                        ? '0 35px 90px rgba(0,0,0,0.5)'
                        : '0 35px 90px rgba(15,23,42,0.12)',
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    background:
                        'radial-gradient(circle at 10% 20%, rgba(96,165,250,0.25), transparent 25%), radial-gradient(circle at 80% 0%, rgba(14,165,233,0.28), transparent 22%), radial-gradient(circle at 90% 80%, rgba(34,197,94,0.22), transparent 26%)',
                    filter: 'blur(60px)',
                    opacity: 0.85,
                }}
            />
            <Stack spacing={2} sx={{ position: 'relative' }}>
                {contextError && <Alert severity="warning">{contextError}</Alert>}
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems="center"
                    flexWrap="wrap"
                >
                    <TextField
                        fullWidth
                        placeholder="Поиск по названию, адресу или описанию"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                            sx: { borderRadius: 3 },
                        }}
                        sx={{ maxWidth: 520 }}
                    />
                    <Button
                        variant="contained"
                        endIcon={<LocationOnIcon />}
                        onClick={() => setMapOpen(true)}
                        sx={{
                            borderRadius: 2.5,
                            px: 2.5,
                            py: 1.2,
                            textTransform: 'none',
                            boxShadow: '0 10px 30px rgba(15,23,42,0.12)',
                            width: { xs: '100%', sm: 'auto' },
                        }}
                    >
                        На карте
                    </Button>
                    <Tooltip title="Обновить">
                        <IconButton
                            size="large"
                            onClick={() => void fetchTasks()}
                            sx={{
                                borderRadius: 2,
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                                boxShadow: '0 10px 30px rgba(15,23,42,0.1)',
                            }}
                        >
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Stack>
        </Box>
    );

    return (
        <Box
            sx={{
                minHeight: '100vh',
                background: gradientBg,
                py: { xs: 4, md: 6 },
            }}
        >
            <Container maxWidth="lg" sx={{ px: { xs: 1.5, sm: 3, md: 4 } }}>
                {hero}
                {loading ? (
                    <Stack alignItems="center" spacing={2} sx={{ py: 6 }}>
                        <CircularProgress />
                        <Typography color="text.secondary">Загружаем задачи…</Typography>
                    </Stack>
                ) : error ? (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                ) : tasks.length === 0 ? (
                    <Alert severity="info" sx={{ mb: 3 }}>
                        Подходящих задач не найдено
                    </Alert>
                ) : (
                    <Grid container spacing={2.5}>
                        {tasks.map((task) => {
                            const chipMeta = task.publicStatus ? statusChipMap[task.publicStatus] : undefined;
                            const taskTitle = [task.taskName, task.bsNumber].filter(Boolean).join(' ');
                            const hasActiveApplication =
                                Boolean(task.myApplication && task.myApplication.status !== 'withdrawn');
                            const isCanceling =
                                Boolean(cancelLoadingId && task.myApplication?._id === cancelLoadingId);

                            return (
                                <Grid item xs={12} md={6} key={task._id}>
                                    <Paper
                                        sx={(theme) => ({
                                            ...glassPaperStyles(theme),
                                            cursor: 'pointer',
                                            transition: 'transform 120ms ease, box-shadow 120ms ease',
                                            '&:hover': {
                                                boxShadow: theme.shadows[10],
                                                transform: 'translateY(-2px)',
                                            },
                                        })}
                                        elevation={0}
                                        onClick={() => setDetailsTask(task)}
                                    >
                                        <Stack spacing={2}>
                                            <Stack spacing={0.25}>
                                                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                                    Организация: {task.orgName || task.orgSlug || task.orgId || '—'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Регион: {task.project?.regionCode || '—'}
                                                    {getRegionLabel(task.project?.regionCode)
                                                        ? ` — ${getRegionLabel(task.project?.regionCode)}`
                                                        : ''}
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" alignItems="center" spacing={1.5}>
                                                <Chip
                                                    size="small"
                                                    color="default"
                                                    variant="outlined"
                                                    label={task.project?.key || 'Публичная задача'}
                                                    sx={{ borderRadius: 2 }}
                                                />
                                                {chipMeta && (
                                                    <Chip
                                                        size="small"
                                                        color={chipMeta.color}
                                                        label={chipMeta.label}
                                                        sx={{ borderRadius: 2 }}
                                                    />
                                                )}
                                                <Chip
                                                    size="small"
                                                    icon={<StarRoundedIcon fontSize="small" />}
                                                    label={`${task.applicationCount ?? 0} откликов`}
                                                    sx={{ borderRadius: 2 }}
                                                />
                                            </Stack>
                                            <Stack spacing={1}>
                                                <Typography variant="h5" fontWeight={700} sx={{ pr: 1, wordBreak: 'break-word' }}>
                                                    {taskTitle || 'Без названия'}
                                                </Typography>
                                                <Stack spacing={0.25}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Планируемый бюджет
                                                    </Typography>
                                                    <Typography variant="subtitle1" fontWeight={700}>
                                                        {formatBudget(task.budget, task.currency)}
                                                    </Typography>
                                                </Stack>
                                            </Stack>
                                            <Typography color="text.secondary" sx={{ lineHeight: 1.5 }}>
                                                {task.publicDescription || task.taskDescription || 'Описание не заполнено'}
                                            </Typography>
                                            {task.skills && task.skills.length > 0 && (
                                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                                    {task.skills.map((skill) => (
                                                        <Chip
                                                            key={skill}
                                                            label={skill}
                                                            size="small"
                                                            sx={{ borderRadius: 2 }}
                                                        />
                                                    ))}
                                                </Stack>
                                            )}
                                            <Divider flexItem />
                                            <Stack
                                                direction={{ xs: 'column', sm: 'row' }}
                                                justifyContent="space-between"
                                                alignItems={{ xs: 'stretch', sm: 'center' }}
                                                spacing={1.5}
                                            >
                                                <Button
                                                    variant="outlined"
                                                    startIcon={<InfoOutlinedIcon />}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDetailsTask(task);
                                                    }}
                                                    sx={{
                                                        borderRadius: 2,
                                                        textTransform: 'none',
                                                    }}
                                                >
                                                    Подробнее
                                                </Button>
                                                {hasActiveApplication ? (
                                                    <Button
                                                        variant="outlined"
                                                        color="error"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            void handleWithdrawApplication(task);
                                                        }}
                                                        disabled={isCanceling}
                                                        sx={{ borderRadius: 2 }}
                                                    >
                                                        {isCanceling ? 'Отменяем…' : 'Отменить отклик'}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="contained"
                                                        size="large"
                                                        endIcon={<ArrowOutwardIcon />}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedTask(task);
                                                        }}
                                                        sx={{
                                                            borderRadius: 2.5,
                                                            px: 3.5,
                                                            py: 1.25,
                                                            textTransform: 'none',
                                                        }}
                                                    >
                                                        Откликнуться
                                                    </Button>
                                                )}
                                            </Stack>
                                        </Stack>
                                    </Paper>
                                </Grid>
                            );
                        })}
                    </Grid>
                )}
            </Container>

            <Dialog fullScreen open={mapOpen} onClose={() => setMapOpen(false)}>
                <DialogContent sx={{ p: 0, bgcolor: 'background.default' }}>
                    <Box
                        sx={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: 2,
                            py: 1.5,
                            borderBottom: 1,
                            borderColor: 'divider',
                            backdropFilter: 'blur(12px)',
                            bgcolor: (theme) =>
                                theme.palette.mode === 'dark'
                                    ? 'rgba(17,24,39,0.9)'
                                    : 'rgba(255,255,255,0.9)',
                        }}
                    >
                        <Typography variant="h6" fontWeight={700}>
                            Публичные задачи на карте
                        </Typography>
                        <IconButton onClick={() => setMapOpen(false)}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                    <Box sx={{ width: '100%', height: 'calc(100vh - 64px)' }}>
                        <MarketLocations onOpenInfo={handleOpenMapInfo} onOpenApply={handleOpenMapApply} />
                    </Box>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(selectedTask)}
                onClose={() => setSelectedTask(null)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        p: 1,
                    },
                }}
            >
                <DialogTitle>
                    {selectedTask
                        ? [selectedTask.taskName, selectedTask.bsNumber].filter(Boolean).join(' ')
                        : 'Отклик на задачу'}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Alert severity="info">
                            Фиксированная ставка, без комиссий платформы. Сообщение увидит работодатель.
                        </Alert>
                        {selectedTask?.publicDescription && (
                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ whiteSpace: 'pre-wrap' }}
                            >
                                {selectedTask.publicDescription}
                            </Typography>
                        )}
                        <TextField
                            label="Ставка за задачу"
                            type="number"
                            value={applyBudget}
                            onChange={(e) => setApplyBudget(e.target.value)}
                            inputProps={{ min: 0 }}
                            fullWidth
                        />
                        <TextField
                            label="Срок (дней)"
                            type="number"
                            value={applyEta}
                            onChange={(e) => setApplyEta(e.target.value)}
                            inputProps={{ min: 0 }}
                            fullWidth
                        />
                        <TextField
                            label="Сообщение"
                            value={applyMessage}
                            onChange={(e) => setApplyMessage(e.target.value)}
                            fullWidth
                            multiline
                            minRows={4}
                        />
                        {userContext?.profileType !== 'contractor' && (
                            <Alert severity="warning">
                                Для отправки отклика выберите роль «Исполнитель» в профиле.
                            </Alert>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setSelectedTask(null)} variant="text">
                        Отмена
                    </Button>
                    <Button
                        onClick={() => void handleSubmitApplication()}
                        variant="contained"
                        endIcon={<SendIcon />}
                        disabled={submitLoading}
                    >
                        {submitLoading ? 'Отправляем…' : 'Отправить'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={Boolean(detailsTask)}
                onClose={() => {
                    setDetailsTask(null);
                    setWorkItemsFullScreen(false);
                }}
                fullScreen
                PaperProps={{
                    sx: {
                        bgcolor: 'background.default',
                    },
                }}
            >
                <DialogContent sx={{ p: 0, bgcolor: 'background.default' }}>
                    <Box
                        sx={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 10,
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            backdropFilter: 'blur(16px)',
                            bgcolor: (theme) =>
                                theme.palette.mode === 'dark'
                                    ? 'rgba(26,32,39,0.8)'
                                    : 'rgba(255,255,255,0.9)',
                        }}
                    >
                        <Container maxWidth="md" sx={{ py: 2.5, px: { xs: 1.5, sm: 3 } }}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="overline" color="text.secondary">
                                        Задача
                                    </Typography>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                        <Typography
                                            variant="h5"
                                            fontWeight={700}
                                            sx={{ wordBreak: 'break-word' }}
                                        >
                                            {detailsTask
                                                ? [detailsTask.taskName, detailsTask.bsNumber]
                                                      .filter(Boolean)
                                                      .join(' ')
                                                : 'Детали задачи'}
                                        </Typography>
                                        {detailsTask?.project?.key && (
                                            <Chip
                                                label={detailsTask.project.key}
                                                variant="outlined"
                                                size="small"
                                                sx={{ borderRadius: 2 }}
                                            />
                                        )}
                                    </Stack>
                                </Box>
                                <Stack direction="row" spacing={1}>
                                    <IconButton
                                        onClick={() => setDetailsTask(null)}
                                        sx={{
                                            borderRadius: 2,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            bgcolor: 'background.paper',
                                        }}
                                    >
                                        <CloseIcon />
                                    </IconButton>
                                </Stack>
                            </Stack>
                        </Container>
                    </Box>

                    <Container maxWidth="md" sx={{ py: 3.5, px: { xs: 1.5, sm: 3 } }}>
                        <Stack spacing={2.5}>
                            <Masonry
                                columns={{ xs: 1, sm: 1, md: 2 }}
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
                                            <strong>Организация:</strong>{' '}
                                            {detailsTask?.orgName ||
                                                detailsTask?.orgSlug ||
                                                detailsTask?.orgId ||
                                                '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Оператор:</strong> {detailsTask?.project?.operator || '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Регион:</strong> {detailsTask?.project?.regionCode || '—'}
                                            {getRegionLabel(detailsTask?.project?.regionCode)
                                                ? ` — ${getRegionLabel(detailsTask?.project?.regionCode)}`
                                                : ''}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Название проекта:</strong> {detailsTask?.project?.name || '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Базовая станция:</strong> {detailsTask?.bsNumber || '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Адрес:</strong> {detailsTask?.bsAddress || '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Геолокация:</strong>{' '}
                                            {detailsTask?.bsLocation?.[0]?.coordinates ||
                                                detailsTask?.bsLocation?.[0]?.name ||
                                                '—'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Срок выполнения:</strong> {formatDateRu(detailsTask?.dueDate)}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Приоритет:</strong>{' '}
                                            {getPriorityLabelRu(detailsTask?.priority) || 'Не указан'}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Плановый бюджет:</strong>{' '}
                                            {formatBudget(detailsTask?.budget, detailsTask?.currency)}
                                        </Typography>
                                        <Typography variant="body1">
                                            <strong>Тип задачи:</strong> {getTaskTypeLabel(detailsTask?.taskType)}
                                        </Typography>
                                    </Stack>
                                </CardItem>

                                {detailsTask?.publicDescription || detailsTask?.taskDescription ? (
                                    <CardItem sx={{ minWidth: 0 }}>
                                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                            Описание
                                        </Typography>
                                        <Divider sx={{ mb: 1.5 }} />
                                        <Typography
                                            color="text.secondary"
                                            sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
                                        >
                                            {detailsTask?.publicDescription || detailsTask?.taskDescription}
                                        </Typography>
                                    </CardItem>
                                ) : null}

                                {detailsTask?.skills && detailsTask.skills.length > 0 ? (
                                    <CardItem sx={{ minWidth: 0 }}>
                                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                            Навыки
                                        </Typography>
                                        <Divider sx={{ mb: 1.5 }} />
                                        <Stack direction="row" spacing={1} flexWrap="wrap">
                                            {detailsTask.skills.map((skill) => (
                                                <Chip key={skill} label={skill} sx={{ borderRadius: 2 }} />
                                            ))}
                                        </Stack>
                                    </CardItem>
                                ) : null}

                                {hasDetailsWorkItems ? (
                                    <CardItem sx={{ minWidth: 0 }}>
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
                                                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
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
                                ) : null}

                                {detailsTask?.attachments && detailsTask.attachments.length > 0 ? (
                                    <CardItem sx={{ minWidth: 0 }}>
                                        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                                            Аттачменты
                                        </Typography>
                                        <Divider sx={{ mb: 1.5 }} />
                                        <Stack spacing={1}>
                                            {detailsTask.attachments.map((link) => (
                                                <Button
                                                    key={link}
                                                    href={link}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    variant="text"
                                                    endIcon={<ArrowOutwardIcon fontSize="small" />}
                                                    sx={{
                                                        justifyContent: 'flex-start',
                                                        textTransform: 'none',
                                                    }}
                                                >
                                                    {link}
                                                </Button>
                                            ))}
                                        </Stack>
                                    </CardItem>
                                ) : null}
                            </Masonry>

                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={1.5}
                                justifyContent="flex-end"
                                alignItems={{ xs: 'stretch', sm: 'center' }}
                            >
                                {detailsTask &&
                                detailsTask.myApplication &&
                                detailsTask.myApplication.status !== 'withdrawn' ? (
                                    <Button
                                        variant="outlined"
                                        color="error"
                                        onClick={() => void handleWithdrawApplication(detailsTask)}
                                        disabled={
                                            Boolean(cancelLoadingId) &&
                                            detailsTask.myApplication?._id === cancelLoadingId
                                        }
                                        sx={{ borderRadius: 2 }}
                                    >
                                        {Boolean(cancelLoadingId) &&
                                        detailsTask.myApplication?._id === cancelLoadingId
                                            ? 'Отменяем…'
                                            : 'Отменить отклик'}
                                    </Button>
                                ) : (
                                    <Button
                                        variant="contained"
                                        size="large"
                                        endIcon={<ArrowOutwardIcon />}
                                        onClick={() => {
                                            if (detailsTask) setSelectedTask(detailsTask);
                                            setDetailsTask(null);
                                        }}
                                        sx={{
                                            borderRadius: 2.5,
                                            px: 3.5,
                                            py: 1.25,
                                            textTransform: 'none',
                                            alignSelf: { xs: 'stretch', sm: 'center' },
                                        }}
                                    >
                                        Откликнуться
                                    </Button>
                                )}
                            </Stack>
                        </Stack>
                    </Container>
                </DialogContent>
            </Dialog>

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

            <Snackbar
                open={snack.open}
                autoHideDuration={4000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    severity={snack.severity}
                    onClose={() => setSnack((s) => ({ ...s, open: false }))}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {snack.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}

// src/app/market/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
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
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import SendIcon from '@mui/icons-material/Send';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import type { PublicTaskStatus, TaskVisibility } from '@/app/types/taskTypes';
import type { TaskApplication } from '@/app/types/application';

type PublicTask = {
    _id: string;
    taskName: string;
    bsNumber?: string;
    orgId?: string;
    orgSlug?: string;
    taskDescription?: string;
    budget?: number;
    currency?: string;
    skills?: string[];
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

function formatBudget(budget?: number, currency?: string) {
    if (!budget || budget <= 0) return 'Бюджет не указан';
    const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
    const code = currency || 'RUB';
    return `${fmt.format(budget)} ${code}`;
}

export default function MarketplacePage() {
    const [tasks, setTasks] = useState<PublicTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [skillsQuery, setSkillsQuery] = useState('');
    const [selectedTask, setSelectedTask] = useState<PublicTask | null>(null);
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

    const derivedSkills = useMemo(
        () =>
            skillsQuery
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
        [skillsQuery]
    );

    const fetchTasks = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set('q', search.trim());
            if (derivedSkills.length > 0) params.set('skills', derivedSkills.join(','));
            const res = await fetch(`/api/tasks/public?${params.toString()}`);
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
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
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
                    <TextField
                        fullWidth
                        placeholder="Навыки через запятую (оптика, электрика)"
                        value={skillsQuery}
                        onChange={(e) => setSkillsQuery(e.target.value)}
                        InputProps={{ sx: { borderRadius: 3 } }}
                        sx={{ maxWidth: 420 }}
                    />
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
                {derivedSkills.length > 0 && (
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        {derivedSkills.map((skill) => (
                            <Chip
                                key={skill}
                                label={skill}
                                color="default"
                                variant="outlined"
                                sx={{ borderRadius: 2 }}
                            />
                        ))}
                    </Stack>
                )}
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
                                    <Paper sx={glassPaperStyles} elevation={0}>
                                        <Stack spacing={2}>
                                            <Stack spacing={0.25}>
                                                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                                                    Организация: {task.orgSlug || task.orgId || '—'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Регион: {task.project?.regionCode || '—'}
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
                                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                <Typography variant="body2" color="text.secondary">
                                                    {task.project?.name || 'Организация скрыта'}
                                                </Typography>
                                                {hasActiveApplication ? (
                                                    <Button
                                                        variant="outlined"
                                                        color="error"
                                                        onClick={() => void handleWithdrawApplication(task)}
                                                        disabled={isCanceling}
                                                    >
                                                        {isCanceling ? 'Отменяем…' : 'Отменить отклик'}
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="contained"
                                                        endIcon={<ArrowOutwardIcon />}
                                                        onClick={() => setSelectedTask(task)}
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

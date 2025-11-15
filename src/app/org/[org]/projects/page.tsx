// src/app/org/[org]/projects/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Paper,
    TextField,
    Typography,
    Alert,
    IconButton,
    Snackbar,
    Stack,
    CircularProgress,
    Tooltip,
    Autocomplete,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useRouter, useParams } from 'next/navigation';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';
import { OPERATORS } from '@/app/utils/operators';

type OrgRole = 'owner' | 'org_admin' | 'manager' | 'executor' | 'viewer';

type Project = {
    _id: string;
    name: string;
    key: string;
    description?: string;
    managers?: string[];
    managerEmail?: string;
    regionCode: string;
    operator: string;
};

type GetProjectsSuccess = { projects: Project[] };
type ApiError = { error: string };

// Ответ /api/org/[org]
type OrgInfoOk = { org: { _id: string; name: string; orgSlug: string }; role: OrgRole };
type OrgInfoErr = { error: string };
type OrgInfoResp = OrgInfoOk | OrgInfoErr;

type Plan = 'free' | 'basic' | 'pro' | 'enterprise';
type SubscriptionStatus = 'active' | 'trial' | 'suspended' | 'past_due' | 'inactive';

type SubscriptionInfo = {
    orgSlug: string;
    plan: Plan;
    status: SubscriptionStatus;
    seats?: number;
    projectsLimit?: number;
    periodStart?: string | null;
    periodEnd?: string | null;
    note?: string;
    updatedByEmail?: string;
    updatedAt: string;
};

type GetSubscriptionResponse = { subscription: SubscriptionInfo };
type PatchSubscriptionResponse = { ok: true; subscription: SubscriptionInfo };

const DAY_MS = 24 * 60 * 60 * 1000;
const TRIAL_DURATION_DAYS = 10;

const parseISODate = (value?: string | null): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
};

export default function OrgProjectsPage() {
    const router = useRouter();

    const params = useParams() as { org: string | string[] };
    const orgSlug = Array.isArray(params.org) ? params.org[0] : params.org;

    const [orgName, setOrgName] = useState<string>(orgSlug);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
    const [subscriptionLoading, setSubscriptionLoading] = useState(true);
    const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
    const [startTrialLoading, setStartTrialLoading] = useState(false);

    // ---- Доступ (только owner/org_admin/manager) ----
    const allowedRoles: OrgRole[] = ['owner', 'org_admin', 'manager'];
    const [myRole, setMyRole] = useState<OrgRole | null>(null);
    const [accessChecked, setAccessChecked] = useState(false);
    const canManage = allowedRoles.includes(myRole ?? 'viewer');

    const checkAccessAndLoadOrg = useCallback(async () => {
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}`);
            const data = (await res.json()) as OrgInfoResp;
            if (!res.ok || 'error' in data) {
                // скрываем существование организации для не-членов
                setMyRole(null);
                setOrgName(orgSlug);
            } else {
                setMyRole(data.role);
                setOrgName(data.org.name);
            }
        } catch {
            setMyRole(null);
            setOrgName(orgSlug);
        } finally {
            setAccessChecked(true);
        }
    }, [orgSlug]);

    // ---- Проекты ----
    const loadProjects = useCallback(async () => {
        if (!canManage) return;
        setLoading(true);
        setErr(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/projects`);
            const data: GetProjectsSuccess | ApiError = await res.json();

            if (!res.ok || !('projects' in data)) {
                setErr('error' in data ? data.error : 'Ошибка загрузки проектов');
                return;
            }

            setProjects(data.projects ?? []);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сети';
            setErr(msg);
        } finally {
            setLoading(false);
        }
    }, [orgSlug, canManage]);

    const loadSubscription = useCallback(async () => {
        if (!orgSlug) return;
        setSubscriptionLoading(true);
        setSubscriptionError(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/subscription`, { cache: 'no-store' });
            const data: GetSubscriptionResponse | ApiError = await res.json();

            if (!res.ok || !('subscription' in data)) {
                const message = 'error' in data ? data.error : 'Не удалось загрузить подписку';
                setSubscriptionError(message);
                setSubscription(null);
                return;
            }

            setSubscriptionError(null);
            setSubscription(data.subscription);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка загрузки подписки';
            setSubscriptionError(msg);
            setSubscription(null);
        } finally {
            setSubscriptionLoading(false);
        }
    }, [orgSlug]);

    useEffect(() => {
        void checkAccessAndLoadOrg();
    }, [checkAccessAndLoadOrg]);

    useEffect(() => {
        if (canManage) void loadProjects();
    }, [canManage, loadProjects]);

    useEffect(() => {
        if (!accessChecked || !canManage) return;
        void loadSubscription();
    }, [accessChecked, canManage, loadSubscription]);

    const trialEndsAt = parseISODate(subscription?.periodEnd);
    const nowTs = Date.now();
    const isTrialActive = subscription?.status === 'trial' && !!trialEndsAt && trialEndsAt.getTime() > nowTs;
    const isTrialExpired = subscription?.status === 'trial' && !isTrialActive;
    const isSubscriptionActive = subscription?.status === 'active' || isTrialActive;
    const trialDaysLeft =
        isTrialActive && trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - nowTs) / DAY_MS)) : null;
    const formattedTrialEnd = trialEndsAt?.toLocaleDateString('ru-RU');
    const isOwnerOrAdmin = myRole === 'owner' || myRole === 'org_admin';
    const canStartTrial =
        isOwnerOrAdmin && (!subscription || subscription.status === 'inactive' || isTrialExpired);
    const disableCreateButton = subscriptionLoading || !isSubscriptionActive;
    const createButtonTooltip = disableCreateButton
        ? subscriptionLoading
            ? 'Проверяем статус подписки…'
            : 'Кнопка доступна после активации подписки или триала'
        : '';

    // ---- Создание ----
    const [openCreate, setOpenCreate] = useState(false);
    const [name, setName] = useState('');
    const [key, setKey] = useState('');
    const [description, setDescription] = useState('');
    const [regionCode, setRegionCode] = useState<string>(RUSSIAN_REGIONS[0]?.code ?? '');
    const [operator, setOperator] = useState<string>(OPERATORS[0]?.value ?? '');

    const handleCreate = async (): Promise<void> => {
        setErr(null);
        if (disableCreateButton) {
            const msg = subscriptionLoading
                ? 'Подождите завершения проверки подписки'
                : 'Подписка не активна. Активируйте тариф или триал';
            showSnack(msg, 'error');
            return;
        }
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, key, description, regionCode, operator }),
            });
            const data: { ok: true; project: Project } | ApiError = await res.json();

            if (!res.ok || !('ok' in data) || !data.ok) {
                const msg = 'error' in data ? data.error : 'Ошибка создания проекта';
                setErr(msg);
                showSnack(msg, 'error');
                return;
            }

            setOpenCreate(false);
            setName('');
            setKey('');
            setDescription('');
            setRegionCode(RUSSIAN_REGIONS[0]?.code ?? '');
            setOperator(OPERATORS[0]?.value ?? '');
            showSnack('Проект создан', 'success');
            void loadProjects();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сети';
            setErr(msg);
            showSnack(msg, 'error');
        }
    };

    // ---- Редактирование ----
    const [openEdit, setOpenEdit] = useState(false);
    const [editProjectId, setEditProjectId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editKey, setEditKey] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editRegionCode, setEditRegionCode] = useState<string>(RUSSIAN_REGIONS[0]?.code ?? '');
    const [editOperator, setEditOperator] = useState<string>(OPERATORS[0]?.value ?? '');

    const openEditDialog = (p: Project) => {
        setEditProjectId(p._id);
        setEditName(p.name);
        setEditKey(p.key);
        setEditDescription(p.description ?? '');
        setEditRegionCode(p.regionCode);
        setEditOperator(p.operator);
        setOpenEdit(true);
    };

    const handleEditSave = async (): Promise<void> => {
        if (!editProjectId) return;
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/projects/${editProjectId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: editName,
                    key: editKey,
                    description: editDescription,
                    regionCode: editRegionCode,
                    operator: editOperator,
                }),
            });
            const data: { ok: true; project: Project } | ApiError = await res.json();

            if (!res.ok || !('ok' in data) || !data.ok) {
                const msg = 'error' in data ? data.error : 'Ошибка обновления проекта';
                setErr(msg);
                showSnack(msg, 'error');
                return;
            }

            setOpenEdit(false);
            setEditProjectId(null);
            showSnack('Проект обновлён', 'success');
            void loadProjects();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сети';
            setErr(msg);
            showSnack(msg, 'error');
        }
    };

    // ---- Удаление ----
    const [openDelete, setOpenDelete] = useState(false);
    const [deleteProject, setDeleteProject] = useState<Project | null>(null);

    const askDelete = (p: Project) => {
        setDeleteProject(p);
        setOpenDelete(true);
    };

    const handleDeleteConfirm = async (): Promise<void> => {
        if (!deleteProject) return;
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/projects/${deleteProject._id}`, {
                method: 'DELETE',
            });
            const data: { ok: true } | ApiError = await res.json();

            if (!res.ok || !('ok' in data) || !data.ok) {
                const msg = 'error' in data ? data.error : 'Ошибка удаления проекта';
                setErr(msg);
                showSnack(msg, 'error');
                return;
            }

            setOpenDelete(false);
            setDeleteProject(null);
            showSnack('Проект удалён', 'success');
            void loadProjects();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сети';
            setErr(msg);
            showSnack(msg, 'error');
        }
    };

    // ---- Навигация по KEY ----
    const handleCardClick = (projectKey: string) => {
        router.push(
            `/org/${encodeURIComponent(orgSlug)}/projects/${encodeURIComponent(projectKey)}/tasks`
        );
    };

    // ---- Снекбар ----
    const [snackOpen, setSnackOpen] = useState(false);
    const [snackMsg, setSnackMsg] = useState('');
    const [snackSeverity, setSnackSeverity] = useState<'success' | 'error'>('success');

    const showSnack = (message: string, severity: 'success' | 'error') => {
        setSnackMsg(message);
        setSnackSeverity(severity);
        setSnackOpen(true);
    };

    const handleStartTrial = async (): Promise<void> => {
        if (!orgSlug || !canStartTrial) return;
        setStartTrialLoading(true);
        setSubscriptionError(null);
        try {
            const now = new Date();
            const trialEnd = new Date(now.getTime() + TRIAL_DURATION_DAYS * DAY_MS);
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/subscription`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'trial',
                    periodStart: now.toISOString(),
                    periodEnd: trialEnd.toISOString(),
                }),
            });
            const data: PatchSubscriptionResponse | ApiError = await res.json();

            if (!res.ok || !('ok' in data) || !data.ok) {
                const msg = 'error' in data ? data.error : 'Не удалось активировать триал';
                setSubscriptionError(msg);
                showSnack(msg, 'error');
                return;
            }

            setSubscription(data.subscription);
            setSubscriptionError(null);
            showSnack('Триал активирован на 10 дней', 'success');
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка запуска триала';
            setSubscriptionError(msg);
            showSnack(msg, 'error');
        } finally {
            setStartTrialLoading(false);
        }
    };

    const isCreateDisabled = useMemo(
        () => !name || !key || !regionCode || !operator || disableCreateButton,
        [name, key, regionCode, operator, disableCreateButton]
    );
    const isEditDisabled = useMemo(
        () => !editName || !editKey || !editRegionCode || !editOperator,
        [editName, editKey, editRegionCode, editOperator]
    );

    // ---- Рендер с учётом доступа ----
    if (!accessChecked) {
        return (
            <Box sx={{ p: 3 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={20} />
                    <Typography>Проверяем доступ…</Typography>
                </Stack>
            </Box>
        );
    }

    if (!canManage) {
        return (
            <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
                <Alert severity="error" variant="outlined">
                    Недостаточно прав для просмотра страницы проектов.
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h5" fontWeight={700}>
                    Проекты / {orgName}
                </Typography>
                <Tooltip title={createButtonTooltip} disableHoverListener={!createButtonTooltip}>
                    <span style={{ display: 'inline-block' }}>
                        <Button variant="contained" onClick={() => setOpenCreate(true)} disabled={disableCreateButton}>
                            Новый проект
                        </Button>
                    </span>
                </Tooltip>
            </Box>

            {subscriptionError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    Не удалось получить статус подписки: {subscriptionError}
                </Alert>
            )}

            {!subscriptionError && subscriptionLoading && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Проверяем статус подписки…
                </Alert>
            )}

            {!subscriptionError && !subscriptionLoading && !isSubscriptionActive && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={2}
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                        justifyContent="space-between"
                    >
                        <Box>
                            <Typography fontWeight={600}>Подписка не активна.</Typography>
                            {isTrialExpired && formattedTrialEnd && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    Пробный период завершился {formattedTrialEnd}.
                                </Typography>
                            )}
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Получите бесплатный триал на {TRIAL_DURATION_DAYS} дней, чтобы создавать проекты.
                            </Typography>
                            {!canStartTrial && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                    Обратитесь к владельцу организации, чтобы активировать подписку.
                                </Typography>
                            )}
                        </Box>
                        {canStartTrial && (
                            <Button
                                variant="contained"
                                color="warning"
                                onClick={handleStartTrial}
                                disabled={startTrialLoading}
                            >
                                {startTrialLoading ? 'Запускаем…' : 'Активировать триал'}
                            </Button>
                        )}
                    </Stack>
                </Alert>
            )}

            {!subscriptionError && !subscriptionLoading && isTrialActive && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Пробный период активен до {formattedTrialEnd ?? '—'}
                    {typeof trialDaysLeft === 'number' && (
                        <Typography component="span" sx={{ ml: 0.5 }}>
                            (осталось {trialDaysLeft} дн.)
                        </Typography>
                    )}
                </Alert>
            )}

            {err && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {err}
                </Alert>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Grid container spacing={2}>
                    {projects.map((p) => {
                        const manager =
                            p.managerEmail ??
                            (Array.isArray(p.managers) && p.managers.length > 0 ? p.managers[0] : '—');
                        const regionLabel = RUSSIAN_REGIONS.find((region) => region.code === p.regionCode)?.name ?? p.regionCode;
                        const operatorLabel = OPERATORS.find((item) => item.value === p.operator)?.label ?? p.operator;

                        return (
                            <Grid key={p._id} item xs={12} md={6} lg={4}>
                                <Paper
                                    sx={{
                                        p: 2,
                                        position: 'relative',
                                        cursor: 'pointer',
                                        transition: 'transform 0.08s ease',
                                        '&:hover': { transform: 'translateY(-2px)' },
                                    }}
                                    onClick={() => handleCardClick(p.key)}
                                    role="button"
                                    aria-label={`Открыть задачи проекта ${p.name}`}
                                    elevation={2}
                                >
                                    {/* Action icons */}
                                    <Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 8, right: 8 }}>
                                        <Tooltip title="Редактировать">
                                            <IconButton
                                                size="small"
                                                aria-label="Редактировать"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEditDialog(p);
                                                }}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Удалить">
                                            <IconButton
                                                size="small"
                                                aria-label="Удалить"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    askDelete(p);
                                                }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Stack>

                                    <Typography variant="subtitle2" color="text.secondary">
                                        {p.key}
                                    </Typography>
                                    <Typography variant="h6" fontWeight={700}>
                                        {p.name}
                                    </Typography>

                                    {p.description && (
                                        <Typography variant="body2" sx={{ mt: 1 }}>
                                            {p.description}
                                        </Typography>
                                    )}

                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Менеджер: <strong>{manager}</strong>
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            Регион: <strong>{regionLabel}</strong>
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Оператор: <strong>{operatorLabel}</strong>
                                        </Typography>
                                    </Box>
                                </Paper>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {/* Create */}
            <Dialog open={openCreate} onClose={() => setOpenCreate(false)}>
                <DialogTitle>Новый проект</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <TextField
                        label="Название"
                        fullWidth
                        sx={{ mt: 1 }}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <TextField
                        label="Код (KEY)"
                        fullWidth
                        sx={{ mt: 2 }}
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                    />
                    <TextField
                        label="Описание"
                        fullWidth
                        multiline
                        minRows={3}
                        sx={{ mt: 2 }}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                    <Box sx={{ mt: 3 }}>
                        <Autocomplete
                            options={RUSSIAN_REGIONS}
                            value={
                                RUSSIAN_REGIONS.find((region) => region.code === regionCode) ?? null
                            }
                            onChange={(_, value) => setRegionCode(value?.code ?? '')}
                            getOptionLabel={(option) => option.name}
                            renderInput={(params) => <TextField {...params} label="Регион" />}
                        />
                    </Box>
                    <Box sx={{ mt: 2 }}>
                        <Autocomplete
                            options={OPERATORS}
                            value={OPERATORS.find((item) => item.value === operator) ?? null}
                            onChange={(_, value) => setOperator(value?.value ?? '')}
                            getOptionLabel={(option) => option.name}
                            renderOption={(props, option) => (
                                <li {...props} key={option.value}>
                                    <Stack
                                        direction="row"
                                        spacing={1}
                                        alignItems="center"
                                        justifyContent="space-between"
                                        sx={{ width: '100%' }}
                                    >
                                        <Typography>{option.name}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {option.visibleCode}
                                        </Typography>
                                    </Stack>
                                </li>
                            )}
                            renderInput={(params) => <TextField {...params} label="Оператор" />}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreate(false)}>Отмена</Button>
                    <Button onClick={handleCreate} variant="contained" disabled={isCreateDisabled}>
                        Создать
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit */}
            <Dialog open={openEdit} onClose={() => setOpenEdit(false)}>
                <DialogTitle>Редактировать проект</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <TextField
                        label="Название"
                        fullWidth
                        sx={{ mt: 1 }}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                    />
                    <TextField
                        label="Код (KEY)"
                        fullWidth
                        sx={{ mt: 2 }}
                        value={editKey}
                        onChange={(e) => setEditKey(e.target.value)}
                    />
                    <TextField
                        label="Описание"
                        fullWidth
                        multiline
                        minRows={3}
                        sx={{ mt: 2 }}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                    />
                    <Box sx={{ mt: 3 }}>
                        <Autocomplete
                            options={RUSSIAN_REGIONS}
                            value={
                                RUSSIAN_REGIONS.find((region) => region.code === editRegionCode) ??
                                null
                            }
                            onChange={(_, value) => setEditRegionCode(value?.code ?? '')}
                            getOptionLabel={(option) => option.name}
                            renderInput={(params) => <TextField {...params} label="Регион" />}
                        />
                    </Box>
                    <Box sx={{ mt: 2 }}>
                        <Autocomplete
                            options={OPERATORS}
                            value={OPERATORS.find((item) => item.value === editOperator) ?? null}
                            onChange={(_, value) => setEditOperator(value?.value ?? '')}
                            getOptionLabel={(option) => option.name}
                            renderOption={(props, option) => (
                                <li {...props} key={option.value}>
                                    <Stack
                                        direction="row"
                                        spacing={1}
                                        alignItems="center"
                                        justifyContent="space-between"
                                        sx={{ width: '100%' }}
                                    >
                                        <Typography>{option.name}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {option.visibleCode}
                                        </Typography>
                                    </Stack>
                                </li>
                            )}
                            renderInput={(params) => <TextField {...params} label="Оператор" />}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenEdit(false)}>Отмена</Button>
                    <Button onClick={handleEditSave} variant="contained" disabled={isEditDisabled}>
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete confirm */}
            <Dialog open={openDelete} onClose={() => setOpenDelete(false)}>
                <DialogTitle>Удалить проект?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Это действие нельзя отменить. Удалить проект <strong>{deleteProject?.name}</strong>?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDelete(false)}>Отмена</Button>
                    <Button color="error" variant="contained" onClick={handleDeleteConfirm}>
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackOpen}
                autoHideDuration={4000}
                onClose={() => setSnackOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
                <Alert onClose={() => setSnackOpen(false)} severity={snackSeverity} variant="filled" sx={{ width: '100%' }}>
                    {snackMsg}
                </Alert>
            </Snackbar>
        </Box>
    );
}

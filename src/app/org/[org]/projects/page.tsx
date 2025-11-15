// src/app/org/[org]/projects/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Paper,
    Typography,
    Alert,
    IconButton,
    Snackbar,
    Stack,
    CircularProgress,
    Tooltip,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import { useRouter, useParams } from 'next/navigation';
import { REGION_MAP, REGION_ISO_MAP } from '@/app/utils/regions';
import { OPERATORS } from '@/app/utils/operators';
import ProjectDialog, {
    ProjectDialogValues,
    ProjectManagerOption,
} from '@/app/workspace/components/ProjectDialog';

const getRegionInfo = (code: string) => REGION_MAP.get(code) ?? REGION_ISO_MAP.get(code);
const getRegionLabel = (code: string): string => getRegionInfo(code)?.label ?? code;
const normalizeRegionCode = (code: string): string => getRegionInfo(code)?.code ?? code;

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
type MemberDTO = {
    _id: string;
    userEmail: string;
    userName?: string;
    role: OrgRole;
    status: 'active' | 'invited';
};
type MembersResponse = { members: MemberDTO[] } | { error: string };

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

    // ---- Участники для менеджеров ----
    const [managerOptions, setManagerOptions] = useState<ProjectManagerOption[]>([]);
    const [managerOptionsError, setManagerOptionsError] = useState<string | null>(null);

    const loadManagerOptions = useCallback(async () => {
        if (!orgSlug) return;
        setManagerOptionsError(null);
        try {
            const res = await fetch(
                `/api/org/${encodeURIComponent(orgSlug)}/members?status=active`,
                { cache: 'no-store' }
            );
            const data: MembersResponse = await res.json();

            if (!res.ok || !('members' in data)) {
                const message = 'error' in data ? data.error : 'Не удалось загрузить участников';
                setManagerOptionsError(message);
                setManagerOptions([]);
                return;
            }

            const filtered = data.members
                .filter((member) => member.status === 'active')
                .filter((member) => ['owner', 'org_admin', 'manager'].includes(member.role));

            setManagerOptions(
                filtered.map((member) => ({
                    email: member.userEmail,
                    name: member.userName,
                    role: member.role,
                }))
            );
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка загрузки участников';
            setManagerOptionsError(msg);
            setManagerOptions([]);
        }
    }, [orgSlug]);

    useEffect(() => {
        void loadManagerOptions();
    }, [loadManagerOptions]);

    // ---- Диалог проекта ----
    const [projectDialogOpen, setProjectDialogOpen] = useState(false);
    const [projectDialogMode, setProjectDialogMode] = useState<'create' | 'edit'>('create');
    const [projectDialogLoading, setProjectDialogLoading] = useState(false);
    const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);

    const openCreateDialog = () => {
        setProjectDialogMode('create');
        setProjectToEdit(null);
        setProjectDialogOpen(true);
    };

    const openEditDialog = (project: Project) => {
        setProjectDialogMode('edit');
        setProjectToEdit(project);
        setProjectDialogOpen(true);
    };

    const handleProjectDialogClose = () => {
        if (projectDialogLoading) return;
        setProjectDialogOpen(false);
        setProjectToEdit(null);
    };

    const handleProjectDialogSubmit = async (values: ProjectDialogValues) => {
        if (!orgSlug) return;
        if (projectDialogMode === 'create' && (subscriptionLoading || !isSubscriptionActive)) {
            const msg = subscriptionLoading
                ? 'Подождите завершения проверки подписки'
                : 'Подписка не активна. Активируйте тариф или триал';
            showSnack(msg, 'error');
            return;
        }
        setProjectDialogLoading(true);
        try {
            const payload = {
                name: values.name,
                key: values.key,
                description: values.description,
                regionCode: values.regionCode,
                operator: values.operator,
                managers: values.managers,
            };

            const url =
                projectDialogMode === 'edit' && projectToEdit?._id
                    ? `/api/org/${encodeURIComponent(orgSlug)}/projects/${projectToEdit._id}`
                    : `/api/org/${encodeURIComponent(orgSlug)}/projects`;
            const method = projectDialogMode === 'edit' ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data: { ok: true; project: Project } | ApiError = await res.json();

            if (!res.ok || !('ok' in data) || !data.ok) {
                const msg = 'error' in data ? data.error : 'Не удалось сохранить проект';
                setErr(msg);
                showSnack(msg, 'error');
                return;
            }

            showSnack(
                projectDialogMode === 'create' ? 'Проект создан' : 'Проект обновлён',
                'success'
            );
            setProjectDialogOpen(false);
            setProjectToEdit(null);
            void loadProjects();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сети';
            setErr(msg);
            showSnack(msg, 'error');
        } finally {
            setProjectDialogLoading(false);
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
                        <Stack direction="row" spacing={1}>
                            <Button
                                variant="outlined"
                                startIcon={<DriveFileMoveIcon />}
                                onClick={() => {
                                    if (!orgSlug) return;
                                    router.push(`/org/${encodeURIComponent(orgSlug)}`);
                                }}
                            >
                                Организация
                            </Button>
                            <Button
                                variant="contained"
                                startIcon={<CreateNewFolderOutlinedIcon />}
                                onClick={openCreateDialog}
                                disabled={disableCreateButton}
                            >
                                Новый проект
                            </Button>
                        </Stack>
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

            {managerOptionsError && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Не удалось загрузить список менеджеров: {managerOptionsError}
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
                        const regionLabel = getRegionLabel(p.regionCode);
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
                                                <EditOutlinedIcon fontSize="small" />
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
                                                <DeleteOutlineOutlinedIcon fontSize="small" />
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

            <ProjectDialog
                open={projectDialogOpen}
                mode={projectDialogMode}
                loading={projectDialogLoading}
                members={managerOptions}
                onClose={handleProjectDialogClose}
                onSubmit={handleProjectDialogSubmit}
                initialData={
                    projectDialogMode === 'edit' && projectToEdit
                        ? {
                              projectId: projectToEdit._id,
                              name: projectToEdit.name,
                              key: projectToEdit.key,
                              description: projectToEdit.description ?? '',
                              regionCode: normalizeRegionCode(projectToEdit.regionCode),
                              operator: projectToEdit.operator,
                              managers: projectToEdit.managers ?? [],
                          }
                        : undefined
                }
            />

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

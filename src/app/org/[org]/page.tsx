// src/app/org/[org]/page.tsx
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Box, Card, CardHeader, CardContent, Stack,
    Snackbar, Alert, Table, TableHead, TableRow, TableCell,
    TableBody, Chip, IconButton, Tooltip, Typography,
    CircularProgress, Grid, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button,
    MenuItem,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LinkIcon from '@mui/icons-material/Link';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import CreateNewFolderOutlinedIcon from '@mui/icons-material/CreateNewFolderOutlined';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import CancelIcon from '@mui/icons-material/Cancel';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';

import InviteMemberForm from '@/app/workspace/components/InviteMemberForm';
import ProjectDialog, {
    ProjectDialogValues,
    ProjectManagerOption,
} from '@/app/workspace/components/ProjectDialog';
import { REGION_MAP, REGION_ISO_MAP } from '@/app/utils/regions';

type OrgRole = 'owner' | 'org_admin' | 'manager' | 'executor' | 'viewer';
type MemberStatus = 'active' | 'invited';

type MemberDTO = {
    _id: string;
    orgSlug: string;
    userEmail: string;
    userName?: string;
    role: OrgRole;
    status: MemberStatus;
    inviteToken?: string;
    inviteExpiresAt?: string;
};

type ProjectDTO = {
    _id: string;
    name: string;
    key: string;
    description?: string;
    managers?: string[];
    managerEmail?: string;
    regionCode: string;
    operator: string;
};

type SnackState = { open: boolean; msg: string; sev: 'success' | 'error' | 'info' };

function roleLabel(r: OrgRole) {
    switch (r) {
        case 'owner': return 'Owner';
        case 'org_admin': return 'Admin';
        case 'manager': return 'Manager';
        case 'executor': return 'Executor';
        case 'viewer': return 'Viewer';
        default: return r;
    }
}

function statusChip(s: MemberStatus) {
    return s === 'active'
        ? <Chip label="active" size="small" color="success" />
        : <Chip label="invited" size="small" color="warning" variant="outlined" />;
}

function normalizeBaseUrl(url: string | undefined | null) {
    if (!url) return '';
    return url.replace(/\/+$/, '');
}

// универсальная склейка на всякий случай
function makeAbsoluteUrl(base: string, path: string) {
    try {
        // URL сам уберёт двойные слэши
        return new URL(path, base).toString();
    } catch {
        // запасной вариант — чуть более грубый
        const cleanBase = normalizeBaseUrl(base);
        const cleanPath = path.replace(/^\/+/, '');
        return `${cleanBase}/${cleanPath}`;
    }
}

export default function OrgSettingsPage() {
    const params = useParams<{ org: string }>();
    const router = useRouter();
    const org = params?.org;

    const allowedRoles: OrgRole[] = ['owner', 'org_admin', 'manager'];
    const [myRole, setMyRole] = React.useState<OrgRole | null>(null);
    const [orgName, setOrgName] = React.useState<string>('');
    const [accessChecked, setAccessChecked] = React.useState(false);
    const canManage = allowedRoles.includes(myRole ?? 'viewer');

    // участники
    const [members, setMembers] = React.useState<MemberDTO[]>([]);
    const [loading, setLoading] = React.useState(false);

    // поиск по участникам
    const [memberSearch, setMemberSearch] = React.useState('');
    const [showMemberSearch, setShowMemberSearch] = React.useState(false);

    // изменение роли участника
    const [roleDialogOpen, setRoleDialogOpen] = React.useState(false);
    const [memberToEditRole, setMemberToEditRole] = React.useState<MemberDTO | null>(null);
    const [newRole, setNewRole] = React.useState<OrgRole>('executor');

    // проекты
    const [projects, setProjects] = React.useState<ProjectDTO[]>([]);
    const [projectsLoading, setProjectsLoading] = React.useState(false);

    // snackbar
    const [snack, setSnack] = React.useState<SnackState>({ open: false, msg: '', sev: 'success' });

    // диалог приглашения
    const [inviteOpen, setInviteOpen] = React.useState(false);
    // снимок e-mail'ов на момент открытия
    const [inviteExistingEmails, setInviteExistingEmails] = React.useState<string[]>([]);

    const managerOptions: ProjectManagerOption[] = React.useMemo(
        () =>
            members
                .filter((member) => member.status === 'active')
                .filter((member) => ['owner', 'org_admin', 'manager'].includes(member.role))
                .map((member) => ({
                    email: member.userEmail,
                    name: member.userName,
                    role: member.role,
                })),
        [members]
    );

    const [projectDialogOpen, setProjectDialogOpen] = React.useState(false);
    const [projectDialogMode, setProjectDialogMode] = React.useState<'create' | 'edit'>('create');
    const [projectDialogLoading, setProjectDialogLoading] = React.useState(false);
    const [projectToEdit, setProjectToEdit] = React.useState<ProjectDTO | null>(null);
    const resolveRegionCode = React.useCallback((code?: string | null) => {
        if (!code) return '';
        if (REGION_MAP.has(code)) return code;
        const match = REGION_ISO_MAP.get(code);
        return match?.code ?? code;
    }, []);

    const openProjectDialog = (project?: ProjectDTO) => {
        if (project) {
            setProjectDialogMode('edit');
            setProjectToEdit(project);
        } else {
            setProjectDialogMode('create');
            setProjectToEdit(null);
        }
        setProjectDialogOpen(true);
    };

    const handleProjectDialogClose = () => {
        if (projectDialogLoading) return;
        setProjectDialogOpen(false);
        setProjectToEdit(null);
    };

    const handleProjectDialogSubmit = async (values: ProjectDialogValues) => {
        if (!org) return;
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
                    ? `/api/org/${encodeURIComponent(org)}/projects/${projectToEdit._id}`
                    : `/api/org/${encodeURIComponent(org)}/projects`;
            const method = projectDialogMode === 'edit' ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok || !data || data.error) {
                const msg = data?.error || 'Не удалось сохранить проект';
                setSnack({ open: true, msg, sev: 'error' });
                return;
            }
            setSnack({
                open: true,
                msg: projectDialogMode === 'create' ? 'Проект создан' : 'Проект обновлён',
                sev: 'success',
            });
            setProjectDialogOpen(false);
            setProjectToEdit(null);
            await fetchProjects();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сети';
            setSnack({ open: true, msg, sev: 'error' });
        } finally {
            setProjectDialogLoading(false);
        }
    };

    // диалог удаления участника
    const [removeOpen, setRemoveOpen] = React.useState(false);
    const [removing, setRemoving] = React.useState(false);
    const [memberToRemove, setMemberToRemove] = React.useState<MemberDTO | null>(null);

    // диалог удаления проекта
    const [removeProjectOpen, setRemoveProjectOpen] = React.useState(false);
    const [removingProject, setRemovingProject] = React.useState(false);
    const [projectToRemove, setProjectToRemove] = React.useState<ProjectDTO | null>(null);

    // база фронтенда для ссылок
    const [frontendBase, setFrontendBase] = React.useState('');

    React.useEffect(() => {
        const envPublic = process.env.NEXT_PUBLIC_FRONTEND_URL;
        const envPrivate = process.env.FRONTEND_URL;
        if (envPublic) {
            setFrontendBase(normalizeBaseUrl(envPublic));
        } else if (envPrivate) {
            setFrontendBase(normalizeBaseUrl(envPrivate));
        } else if (typeof window !== 'undefined') {
            setFrontendBase(normalizeBaseUrl(window.location.origin));
        }
    }, []);

    // загрузка инфы об организации и своей роли
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!org) return;
            try {
                const res = await fetch(`/api/org/${encodeURIComponent(org)}`);
                type OrgInfoOk = { org: { _id: string; name: string; orgSlug: string }; role: OrgRole };
                const data = (await res.json().catch(() => ({}))) as OrgInfoOk | { error: string };
                if (!cancelled) {
                    if (!res.ok || 'error' in data) {
                        setMyRole(null);
                    } else {
                        setMyRole(data.role);
                        setOrgName(data.org.name);
                    }
                    setAccessChecked(true);
                }
            } catch {
                if (!cancelled) {
                    setMyRole(null);
                    setAccessChecked(true);
                }
            }
        })();
        return () => { cancelled = true; };
    }, [org]);

    const fetchMembers = React.useCallback(async () => {
        if (!org || !canManage) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/members`, { cache: 'no-store' });
            const data = (await res.json().catch(() => ({}))) as { members?: MemberDTO[]; error?: string };
            if (!res.ok) {
                setSnack({ open: true, msg: data?.error || res.statusText, sev: 'error' });
                return;
            }
            setMembers(Array.isArray(data?.members) ? data.members : []);
        } finally {
            setLoading(false);
        }
    }, [org, canManage]);

    const fetchProjects = React.useCallback(async () => {
        if (!org || !canManage) return;
        setProjectsLoading(true);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/projects`, { cache: 'no-store' });
            const data = (await res.json().catch(() => ({}))) as { projects?: ProjectDTO[]; error?: string };
            if (!res.ok) {
                setSnack({ open: true, msg: data?.error || res.statusText, sev: 'error' });
                return;
            }
            setProjects(Array.isArray(data?.projects) ? data.projects : []);
        } finally {
            setProjectsLoading(false);
        }
    }, [org, canManage]);

    // слушаем событие успешного приглашения
    React.useEffect(() => {
        const handler = async () => {
            // диалог не закрываем — просто обновляем список
            await fetchMembers();
        };
        window.addEventListener('org-members:invited', handler as EventListener);
        return () => window.removeEventListener('org-members:invited', handler as EventListener);
    }, [fetchMembers]);

    // первичная загрузка
    React.useEffect(() => {
        if (canManage) {
            void fetchMembers();
            void fetchProjects();
        }
    }, [canManage, fetchMembers, fetchProjects]);

    const handleRefreshClick = () => {
        void fetchMembers();
        void fetchProjects();
    };

    // удаление участника
    const openRemoveDialog = (m: MemberDTO) => {
        setMemberToRemove(m);
        setRemoveOpen(true);
    };
    const closeRemoveDialog = () => {
        if (removing) return;
        setRemoveOpen(false);
        setMemberToRemove(null);
    };
    const confirmRemove = async () => {
        if (!org || !memberToRemove?._id || !canManage) return;
        setRemoving(true);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/members/${memberToRemove._id}`, { method: 'DELETE' });
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setSnack({ open: true, msg: data?.error || res.statusText, sev: 'error' });
                return;
            }
            setSnack({ open: true, msg: 'Участник удалён', sev: 'success' });
            await fetchMembers();
            closeRemoveDialog();
        } finally {
            setRemoving(false);
        }
    };

    // удаление проекта
    const openRemoveProjectDialog = (p: ProjectDTO) => {
        setProjectToRemove(p);
        setRemoveProjectOpen(true);
    };
    const closeRemoveProjectDialog = () => {
        if (removingProject) return;
        setRemoveProjectOpen(false);
        setProjectToRemove(null);
    };
    const confirmRemoveProject = async () => {
        if (!org || !projectToRemove?._id || !canManage) return;
        setRemovingProject(true);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/projects/${projectToRemove._id}`, {
                method: 'DELETE',
            });
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setSnack({ open: true, msg: data?.error || res.statusText, sev: 'error' });
                return;
            }
            setSnack({ open: true, msg: 'Проект удалён', sev: 'success' });
            await fetchProjects();
            closeRemoveProjectDialog();
        } finally {
            setRemovingProject(false);
        }
    };

    const formatExpire = (iso?: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const goToProjectsPage = () => {
        if (!org) return;
        router.push(`/org/${encodeURIComponent(org)}/projects`);
    };

    const filteredMembers = (() => {
        const q = memberSearch.trim().toLowerCase();
        if (!q) return members;
        return members.filter((m) => {
            const name = (m.userName || '').toLowerCase();
            const email = (m.userEmail || '').toLowerCase();
            return name.includes(q) || email.includes(q);
        });
    })();

    const memberByEmail = (() => {
        const map = new Map<string, MemberDTO>();
        for (const m of members) {
            if (m.userEmail) {
                map.set(m.userEmail.toLowerCase(), m);
            }
        }
        return map;
    })();

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
                    Недостаточно прав для просмотра страницы настроек организации.
                </Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
                Организация - {orgName || org}
            </Typography>

            <Grid container spacing={2}>
                {/* ПРОЕКТЫ */}
                <Grid item xs={12}>
                    <Card variant="outlined">
                        <CardHeader
                            title={`Проекты организации (${projects.length})`}
                            action={
                                <Stack direction="row" spacing={1}>
                                    <Tooltip title="Создать проект">
                                        <span>
                                            <IconButton onClick={() => openProjectDialog()}>
                                                <CreateNewFolderOutlinedIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    <Tooltip title="Перейти к проектам">
                                        <span>
                                            <IconButton onClick={goToProjectsPage}>
                                                <DriveFileMoveIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    <Tooltip title="Обновить">
                                        <span>
                                            <IconButton onClick={handleRefreshClick} disabled={projectsLoading || loading}>
                                                <RefreshIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            }
                        />
                        <CardContent>
                            {projectsLoading ? (
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <CircularProgress size={20} />
                                    <Typography>Загрузка проектов…</Typography>
                                </Stack>
                            ) : (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Код</TableCell>
                                            <TableCell>Проект</TableCell>
                                            <TableCell>Менеджер</TableCell>
                                            <TableCell>Описание</TableCell>
                                            <TableCell align="right">Действия</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {projects.map((p) => {
                                            return (
                                                <TableRow key={p._id} hover>
                                                    <TableCell
                                                        sx={{ cursor: 'pointer' }}
                                                        onClick={() =>
                                                            router.push(
                                                                `/org/${encodeURIComponent(String(org))}/projects/${encodeURIComponent(p.key)}/tasks`
                                                            )
                                                        }
                                                    >
                                                        {p.key}
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ cursor: 'pointer' }}
                                                        onClick={() =>
                                                            router.push(
                                                                `/org/${encodeURIComponent(String(org))}/projects/${encodeURIComponent(p.key)}/tasks`
                                                            )
                                                        }
                                                    >
                                                        {p.name}
                                                    </TableCell>
                                                    <TableCell>
                                                        {(() => {
                                                            const rawEmail =
                                                                p.managerEmail ||
                                                                (Array.isArray(p.managers) && p.managers.length > 0
                                                                    ? p.managers[0]
                                                                    : '');
                                                            const normalized = rawEmail ? rawEmail.trim().toLowerCase() : '';
                                                            const member = normalized ? memberByEmail.get(normalized) : undefined;

                                                            const name = member?.userName || '';
                                                            const email = member?.userEmail || rawEmail || '';

                                                            if (name && email) {
                                                                return (
                                                                    <Box>
                                                                        <Typography variant="body2">{name}</Typography>
                                                                        <Typography variant="caption" color="text.secondary">
                                                                            {email}
                                                                        </Typography>
                                                                    </Box>
                                                                );
                                                            }

                                                            if (email) {
                                                                return <Typography variant="body2">{email}</Typography>;
                                                            }

                                                            return (
                                                                <Typography variant="body2" color="text.secondary">
                                                                    —
                                                                </Typography>
                                                            );
                                                        })()}
                                                    </TableCell>
                                                    <TableCell sx={{ maxWidth: 360 }}>
                                                        <Typography variant="body2" color="text.secondary" noWrap>
                                                            {p.description || '—'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Tooltip title="Редактировать проект">
                                                            <IconButton onClick={() => openProjectDialog(p)}>
                                                                <EditOutlinedIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Удалить проект">
                                                            <IconButton onClick={() => openRemoveProjectDialog(p)}>
                                                                <DeleteOutlineOutlinedIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}

                                        {projects.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5}>
                                                    <Typography color="text.secondary">
                                                        Проектов пока нет. Нажмите «Создать».
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </Grid>

                {/* УЧАСТНИКИ */}
                <Grid item xs={12}>
                    <Card variant="outlined">
                        <CardHeader
                            title={`Участники организации (${members.length})`}
                            subheader={`Действующие и приглашённые участники ${orgName || org}`}
                            action={
                                <Stack direction="row" spacing={1}>
                                    <Tooltip title={showMemberSearch ? 'Скрыть поиск' : 'Поиск по участникам'}>
                                        <span>
                                            <IconButton
                                                onClick={() => setShowMemberSearch((prev) => !prev)}
                                                color={showMemberSearch ? 'primary' : 'default'}
                                            >
                                                <PersonSearchIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    <Tooltip title="Пригласить участника">
                                        <span>
                                            <IconButton
                                                onClick={() => {
                                                    // фиксируем e-mail'ы на момент открытия
                                                    setInviteExistingEmails(members.map((m) => m.userEmail.toLowerCase()));
                                                    setInviteOpen(true);
                                                }}
                                            >
                                                <PersonAddIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                    <Tooltip title="Обновить">
                                        <span>
                                            <IconButton onClick={handleRefreshClick} disabled={loading || projectsLoading}>
                                                <RefreshIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Stack>
                            }
                        />
                        <CardContent>
                            {showMemberSearch && (
                                <Box sx={{ mb: 2, maxWidth: 360 }}>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <TextField
                                            size="small"
                                            fullWidth
                                            label="Поиск по имени или e-mail"
                                            value={memberSearch}
                                            onChange={(e) => setMemberSearch(e.target.value)}
                                        />
                                        <Tooltip title="Сбросить поиск">
                                            <IconButton
                                                onClick={() => {
                                                    setMemberSearch('');
                                                    setShowMemberSearch(false);
                                                }}
                                            >
                                                <CancelIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Stack>
                                </Box>
                            )}

                            {loading ? (
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <CircularProgress size={20} />
                                    <Typography>Загрузка участников…</Typography>
                                </Stack>
                            ) : (
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Имя</TableCell>
                                            <TableCell>E-mail</TableCell>
                                            <TableCell>Роль</TableCell>
                                            <TableCell>Статус</TableCell>
                                            <TableCell align="right">Действия</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredMembers.map((m) => {
                                            const isInvited = m.status === 'invited';
                                            const invitePath = `/org/${encodeURIComponent(String(org))}/join?token=${encodeURIComponent(
                                                m.inviteToken || ''
                                            )}`;
                                            const inviteLink =
                                                isInvited && m.inviteToken
                                                    ? (frontendBase ? makeAbsoluteUrl(frontendBase, invitePath) : invitePath)
                                                    : undefined;

                                            return (
                                                <TableRow
                                                    key={m._id}
                                                    sx={isInvited ? { opacity: 0.85 } : undefined}
                                                    title={isInvited ? 'Приглашение отправлено, ожидаем подтверждения' : undefined}
                                                >
                                                    <TableCell>{m.userName || '—'}</TableCell>
                                                    <TableCell>{m.userEmail}</TableCell>
                                                    <TableCell>{roleLabel(m.role)}</TableCell>
                                                    <TableCell>
                                                        <Stack direction="row" spacing={1} alignItems="center">
                                                            {statusChip(m.status)}
                                                            {isInvited && m.inviteExpiresAt && (
                                                                <Chip
                                                                    size="small"
                                                                    variant="outlined"
                                                                    label={`до ${formatExpire(m.inviteExpiresAt)}`}
                                                                />
                                                            )}
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {inviteLink && (
                                                            <Tooltip title="Скопировать ссылку приглашения">
                                                                <IconButton
                                                                    onClick={() => {
                                                                        void navigator.clipboard.writeText(inviteLink).then(() =>
                                                                            setSnack({ open: true, msg: 'Ссылка скопирована', sev: 'info' })
                                                                        );
                                                                    }}
                                                                >
                                                                    <LinkIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}

                                                        {m.role !== 'owner' && (
                                                            <Tooltip title="Изменить роль">
                                                                <IconButton
                                                                    onClick={() => {
                                                                        setMemberToEditRole(m);
                                                                        setNewRole(m.role);
                                                                        setRoleDialogOpen(true);
                                                                    }}
                                                                >
                                                                    <ManageAccountsIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}

                                                        {m.role !== 'owner' && (
                                                            <Tooltip title="Удалить участника">
                                                            <IconButton onClick={() => openRemoveDialog(m)}>
                                                                <DeleteOutlineOutlinedIcon fontSize="small" />
                                                            </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}

                                        {filteredMembers.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5}>
                                                    <Typography color="text.secondary">
                                                        Не найдено участников по запросу.
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Диалог добавления участника */}
            <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Пригласить участника</DialogTitle>
                <DialogContent dividers>
                    {org && (
                        <InviteMemberForm
                            org={org}
                            defaultRole="executor"
                            // передаём снимок, чтобы не было "уже в организации" сразу после генерации
                            existingEmails={inviteExistingEmails}
                        />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setInviteOpen(false)}>Закрыть</Button>
                </DialogActions>
            </Dialog>

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
                              regionCode: resolveRegionCode(projectToEdit.regionCode),
                              operator: projectToEdit.operator,
                              managers: projectToEdit.managers ?? [],
                          }
                        : undefined
                }
            />

            {/* Диалог изменения роли участника */}
            <Dialog open={roleDialogOpen} onClose={() => setRoleDialogOpen(false)}>
                <DialogTitle>Изменить роль участника</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                        {memberToEditRole?.userName || memberToEditRole?.userEmail}
                    </Typography>
                    <TextField
                        select
                        label="Роль"
                        fullWidth
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as OrgRole)}
                        sx={{ mt: 1 }}
                    >
                        {(['org_admin', 'manager', 'executor', 'viewer'] as OrgRole[]).map((r) => (
                            <MenuItem key={r} value={r}>
                                {roleLabel(r)}
                            </MenuItem>
                        ))}
                    </TextField>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRoleDialogOpen(false)}>Отмена</Button>
                    <Button
                        variant="contained"
                        onClick={async () => {
                            if (!org || !memberToEditRole?._id) return;
                            try {
                                const res = await fetch(
                                    `/api/org/${encodeURIComponent(org)}/members/${memberToEditRole._id}`,
                                    {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ role: newRole }),
                                    }
                                );
                                const data = await res.json();
                                if (!res.ok) {
                                    setSnack({ open: true, msg: data?.error || 'Ошибка изменения роли', sev: 'error' });
                                    return;
                                }
                                setSnack({ open: true, msg: 'Роль обновлена', sev: 'success' });
                                setRoleDialogOpen(false);
                                setMemberToEditRole(null);
                                await fetchMembers();
                            } catch (e: unknown) {
                                const msg = e instanceof Error ? e.message : 'Ошибка сети';
                                setSnack({ open: true, msg, sev: 'error' });
                            }
                        }}
                    >
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог удаления участника */}
            <Dialog open={removeOpen} onClose={removing ? undefined : closeRemoveDialog}>
                <DialogTitle>Удалить участника?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        Вы действительно хотите удалить участника{' '}
                        <b>{memberToRemove?.userName || memberToRemove?.userEmail}</b>{' '}
                        из организации? Доступ пользователя {memberToRemove?.userName || memberToRemove?.userEmail} к проектам будет утерян.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeRemoveDialog} disabled={removing}>Отмена</Button>
                    <Button color="error" variant="contained" onClick={confirmRemove} disabled={removing}>
                        {removing ? 'Удаляем…' : 'Удалить'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог удаления проекта */}
            <Dialog open={removeProjectOpen} onClose={removingProject ? undefined : closeRemoveProjectDialog}>
                <DialogTitle>Удалить проект?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        Вы действительно хотите удалить проект{' '}
                        <b>{projectToRemove?.name || projectToRemove?.key}</b>?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeRemoveProjectDialog} disabled={removingProject}>Отмена</Button>
                    <Button color="error" variant="contained" onClick={confirmRemoveProject} disabled={removingProject}>
                        {removingProject ? 'Удаляем…' : 'Удалить'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
            >
                <Alert onClose={() => setSnack((s) => ({ ...s, open: false }))} severity={snack.sev} variant="filled">
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}

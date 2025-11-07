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
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LinkIcon from '@mui/icons-material/Link';
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';

import InviteMemberForm from '@/app/workspace/components/InviteMemberForm';

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
    const [memberSearch, setMemberSearch] = React.useState('');

    // проекты
    const [projects, setProjects] = React.useState<ProjectDTO[]>([]);
    const [projectsLoading, setProjectsLoading] = React.useState(false);

    // snackbar
    const [snack, setSnack] = React.useState<SnackState>({ open: false, msg: '', sev: 'success' });

    // диалог приглашения
    const [inviteOpen, setInviteOpen] = React.useState(false);

    // диалог создания проекта
    const [createOpen, setCreateOpen] = React.useState(false);
    const [newProjectName, setNewProjectName] = React.useState('');
    const [newProjectKey, setNewProjectKey] = React.useState('');
    const [newProjectDescription, setNewProjectDescription] = React.useState('');
    const isCreateDisabled = !newProjectName || !newProjectKey;

    // диалог удаления участника
    const [removeOpen, setRemoveOpen] = React.useState(false);
    const [removing, setRemoving] = React.useState(false);
    const [memberToRemove, setMemberToRemove] = React.useState<MemberDTO | null>(null);

    // диалог удаления проекта
    const [removeProjectOpen, setRemoveProjectOpen] = React.useState(false);
    const [removingProject, setRemovingProject] = React.useState(false);
    const [projectToRemove, setProjectToRemove] = React.useState<ProjectDTO | null>(null);

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
            await fetchMembers();
            setInviteOpen(false);
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
            // если у тебя удаление по key — поменяй здесь на projectToRemove.key
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

    const handleCreateProject = async () => {
        if (!org) return;
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newProjectName,
                    key: newProjectKey,
                    description: newProjectDescription,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data?.ok) {
                setSnack({ open: true, msg: data?.error || 'Ошибка создания проекта', sev: 'error' });
                return;
            }
            setSnack({ open: true, msg: 'Проект создан', sev: 'success' });
            setCreateOpen(false);
            setNewProjectName('');
            setNewProjectKey('');
            setNewProjectDescription('');
            void fetchProjects();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сети';
            setSnack({ open: true, msg, sev: 'error' });
        }
    };

    // ↓↓↓ ЭТО ПРОСТО ПЕРЕМЕННЫЕ, НЕ ХУКИ ↓↓↓
    const existingMemberEmails = members.map((m) => m.userEmail.toLowerCase());
    const filteredMembers = (() => {
        const q = memberSearch.trim().toLowerCase();
        if (!q) return members;
        return members.filter((m) => {
            const name = (m.userName || '').toLowerCase();
            const email = (m.userEmail || '').toLowerCase();
            return name.includes(q) || email.includes(q);
        });
    })();
    // ↑↑↑

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
                Настройки организации: {orgName || org}
            </Typography>

            <Grid container spacing={2}>
                {/* Участники */}
                <Grid item xs={12}>
                    <Card variant="outlined">
                        <CardHeader
                            title="Участники организации"
                            action={
                                <Stack direction="row" spacing={1}>
                                    <Tooltip title="Пригласить участника">
                    <span>
                      <IconButton onClick={() => setInviteOpen(true)}>
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
                            <Box sx={{ mb: 2, maxWidth: 360 }}>
                                <TextField
                                    size="small"
                                    fullWidth
                                    label="Поиск по имени или e-mail"
                                    value={memberSearch}
                                    onChange={(e) => setMemberSearch(e.target.value)}
                                />
                            </Box>

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
                                            const inviteLink = isInvited && m.inviteToken
                                                ? `/org/${encodeURIComponent(String(org))}/join?token=${encodeURIComponent(m.inviteToken)}`
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
                                                                <Chip size="small" variant="outlined" label={`до ${formatExpire(m.inviteExpiresAt)}`} />
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
                                                            <Tooltip title="Удалить участника">
                                                                <IconButton onClick={() => openRemoveDialog(m)}>
                                                                    <DeleteOutlineIcon fontSize="small" />
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

                {/* Проекты */}
                <Grid item xs={12}>
                    <Card variant="outlined">
                        <CardHeader
                            title="Проекты организации"
                            action={
                                <Stack direction="row" spacing={1}>
                                    <Tooltip title="Создать проект">
                    <span>
                      <IconButton onClick={() => setCreateOpen(true)}>
                        <CreateNewFolderIcon />
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
                                            const manager =
                                                p.managerEmail ??
                                                (Array.isArray(p.managers) && p.managers.length > 0 ? p.managers[0] : '—');

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
                                                    <TableCell>{manager}</TableCell>
                                                    <TableCell sx={{ maxWidth: 360 }}>
                                                        <Typography variant="body2" color="text.secondary" noWrap>
                                                            {p.description || '—'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Tooltip title="Удалить проект">
                                                            <IconButton onClick={() => openRemoveProjectDialog(p)}>
                                                                <DeleteOutlineIcon fontSize="small" />
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
                                                        Проектов пока нет. Нажмите «Создать» или зайдите на страницу проектов.
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
                            existingEmails={existingMemberEmails}
                        />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setInviteOpen(false)}>Закрыть</Button>
                </DialogActions>
            </Dialog>

            {/* Диалог создания проекта */}
            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Новый проект</DialogTitle>
                <DialogContent dividers>
                    <TextField
                        label="Название"
                        fullWidth
                        sx={{ mt: 1 }}
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                    />
                    <TextField
                        label="Код (KEY)"
                        fullWidth
                        sx={{ mt: 2 }}
                        value={newProjectKey}
                        onChange={(e) => setNewProjectKey(e.target.value)}
                    />
                    <TextField
                        label="Описание"
                        fullWidth
                        multiline
                        minRows={3}
                        sx={{ mt: 2 }}
                        value={newProjectDescription}
                        onChange={(e) => setNewProjectDescription(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateOpen(false)}>Отмена</Button>
                    <Button variant="contained" onClick={handleCreateProject} disabled={isCreateDisabled}>
                        Создать
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
                        из организации? Доступ к проектам будет утерян.
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

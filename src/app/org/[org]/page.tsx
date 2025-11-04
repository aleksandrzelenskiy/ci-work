// src/app/org/[org]/page.tsx
'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
    Box, Card, CardHeader, CardContent, Button, Stack,
    Snackbar, Alert, Table, TableHead, TableRow, TableCell,
    TableBody, Chip, IconButton, Tooltip, Typography,
    CircularProgress, Grid, Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import LinkIcon from '@mui/icons-material/Link';

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

    // нужно только для построения ссылки приглашения
    inviteToken?: string;        // приходит из API только для manager/admin/owner
    inviteExpiresAt?: string;    // ISO-строка, опционально
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
    const org = params?.org;

    // ── Проверка роли / доступ ─────────────────────────────────────────────
    const allowedRoles: OrgRole[] = ['owner', 'org_admin', 'manager'];
    const [myRole, setMyRole] = React.useState<OrgRole | null>(null);
    const [orgName, setOrgName] = React.useState<string>('');
    const [accessChecked, setAccessChecked] = React.useState(false);
    const canManage = allowedRoles.includes(myRole ?? 'viewer');

    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!org) return;
            try {
                const res = await fetch(`/api/org/${encodeURIComponent(org)}`);
                type OrgInfoOk = { org: { _id: string; name: string; orgSlug: string }; role: OrgRole };
                type OrgInfoErr = { error: string };
                const data = (await res.json().catch(() => ({}))) as OrgInfoOk | OrgInfoErr;

                if (!cancelled) {
                    if (!res.ok || 'error' in data) {
                        setMyRole(null);
                    } else {
                        setMyRole((data as OrgInfoOk).role);
                        setOrgName((data as OrgInfoOk).org.name);
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

    // ── Остальные состояния ────────────────────────────────────────────────
    const [members, setMembers] = React.useState<MemberDTO[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [snack, setSnack] = React.useState<SnackState>({ open: false, msg: '', sev: 'success' });

    // диалог добавления участника
    const [inviteOpen, setInviteOpen] = React.useState(false);

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

    React.useEffect(() => {
        const handler = async () => {
            await fetchMembers();
            setInviteOpen(false);
        };
        window.addEventListener('org-members:invited', handler as EventListener);
        return () => window.removeEventListener('org-members:invited', handler as EventListener);
    }, [fetchMembers]);

    React.useEffect(() => { if (canManage) void fetchMembers(); }, [fetchMembers, canManage]);

    const handleRefreshClick = () => { void fetchMembers(); };

    // ── Удаление участника ────────────────────────────────────────────────
    const [removeOpen, setRemoveOpen] = React.useState(false);
    const [removing, setRemoving] = React.useState(false);
    const [memberToRemove, setMemberToRemove] = React.useState<MemberDTO | null>(null);

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
            const res = await fetch(
                `/api/org/${encodeURIComponent(org)}/members/${memberToRemove._id}`,
                { method: 'DELETE' }
            );
            const data: unknown = await res.json().catch(() => ({}));
            type ErrorShape = { error?: unknown };
            const err = (data as ErrorShape).error;
            const errorMsg = typeof err === 'string' ? err : res.statusText;

            if (!res.ok) {
                setSnack({ open: true, msg: errorMsg, sev: 'error' });
                return;
            }

            setSnack({ open: true, msg: 'Участник удалён', sev: 'success' });
            await fetchMembers();
            closeRemoveDialog();
        } finally {
            setRemoving(false);
        }
    };

    // ── Рендер с учётом доступа ───────────────────────────────────────────
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

    const formatExpire = (iso?: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
                Настройки организации: {orgName || org}
            </Typography>

            <Grid container spacing={2}>
                {/* Таблица участников */}
                <Grid item xs={12}>
                    <Card variant="outlined">
                        <CardHeader
                            title="Участники организации"
                            action={
                                <Tooltip title="Обновить">
                  <span>
                    <IconButton onClick={handleRefreshClick} disabled={loading}>
                      <RefreshIcon />
                    </IconButton>
                  </span>
                                </Tooltip>
                            }
                        />
                        <CardContent>
                            {loading ? (
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <CircularProgress size={20} />
                                    <Typography>Загрузка участников…</Typography>
                                </Stack>
                            ) : (
                                <>
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
                                            {members.map((m) => {
                                                const isInvited = m.status === 'invited';
                                                // строим относительную ссылку — фронт знает BASE-URL
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
                                                                    <Chip
                                                                        size="small"
                                                                        variant="outlined"
                                                                        label={`до ${formatExpire(m.inviteExpiresAt)}`}
                                                                    />
                                                                )}
                                                            </Stack>
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            {/* Только ссылка, без токена */}
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

                                                            {/* Удалить участника (кроме владельца) */}
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

                                            {/* Пустой список */}
                                            {members.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5}>
                                                        <Typography color="text.secondary">Участников пока нет.</Typography>
                                                    </TableCell>
                                                </TableRow>
                                            )}

                                            <TableRow>
                                                <TableCell colSpan={5} align="right">
                                                    <Button startIcon={<PersonAddIcon />} variant="contained" onClick={() => setInviteOpen(true)}>
                                                        Добавить
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </>
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
                        />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setInviteOpen(false)}>Закрыть</Button>
                </DialogActions>
            </Dialog>

            {/* Диалог подтверждения удаления */}
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

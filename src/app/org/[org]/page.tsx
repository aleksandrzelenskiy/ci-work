// src/app/org/[org]/page.tsx
'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
    Box, Card, CardHeader, CardContent, TextField, Button, Stack, Select, MenuItem,
    InputLabel, FormControl, Snackbar, Alert, Table, TableHead, TableRow, TableCell,
    TableBody, Chip, IconButton, Tooltip, Divider, Typography, CircularProgress, Grid,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

type OrgRole = 'owner' | 'org_admin' | 'manager' | 'executor' | 'viewer';
type MemberStatus = 'active' | 'invited';
type MemberDTO = {
    _id: string;
    orgSlug: string;
    userEmail: string;
    userName?: string;
    role: OrgRole;
    status: MemberStatus;
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
                type OrgInfoResp = OrgInfoOk | OrgInfoErr;

                const data = (await res.json().catch(() => ({}))) as OrgInfoResp;

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

    // ── Остальные состояния ────────────────────────────────────────────────
    const [members, setMembers] = React.useState<MemberDTO[]>([]);
    const [loading, setLoading] = React.useState(false);

    // autocomplete для формы приглашения
    type UserOption = { email: string; name?: string; profilePic?: string };
    const [userQuery, setUserQuery] = React.useState('');
    const [userOpts, setUserOpts] = React.useState<UserOption[]>([]);
    const [userLoading, setUserLoading] = React.useState(false);
    const [selectedUser, setSelectedUser] = React.useState<UserOption | null>(null);

    // форма приглашения
    const [invEmail, setInvEmail] = React.useState('');
    const [invRole, setInvRole] = React.useState<OrgRole>('executor');
    const [inviting, setInviting] = React.useState(false);

    // сгенерированная ссылка
    const [inviteLink, setInviteLink] = React.useState<string | null>(null);
    const [inviteExpiresAt, setInviteExpiresAt] = React.useState<string | null>(null);

    const [snack, setSnack] = React.useState<SnackState>({ open: false, msg: '', sev: 'success' });

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

    // запрос к данным users (делаем только если есть доступ)
    React.useEffect(() => {
        if (!org || !canManage) return;
        const q = userQuery.trim();
        if (!q) { setUserOpts([]); return; }
        const ctrl = new AbortController();
        setUserLoading(true);
        const t = setTimeout(async () => {
            try {
                const res = await fetch(
                    `/api/org/${encodeURIComponent(org)}/users/search?q=${encodeURIComponent(q)}&limit=8`,
                    { signal: ctrl.signal }
                );
                const data = (await res.json().catch(() => ({}))) as { users?: UserOption[] };
                setUserOpts(Array.isArray(data.users) ? data.users : []);
            } catch { /* ignore */ }
            finally { setUserLoading(false); }
        }, 250);
        return () => { clearTimeout(t); ctrl.abort(); };
    }, [org, userQuery, canManage]);

    // когда выбираем пользователя — заполняем invEmail и отображаем имя из users
    React.useEffect(() => {
        setInvEmail(selectedUser ? selectedUser.email : '');
    }, [selectedUser]);

    React.useEffect(() => { if (canManage) void fetchMembers(); }, [fetchMembers, canManage]);

    const invite = React.useCallback(async () => {
        if (!org || !invEmail || !canManage) return;
        setInviting(true);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/members/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userEmail: invEmail.trim(),
                    role: invRole,
                }),
            });
            const data = (await res.json().catch(() => ({}))) as
                | { ok: true; inviteUrl: string; expiresAt: string; role: OrgRole }
                | { error?: string };

            if (!res.ok || !('ok' in data)) {
                setSnack({ open: true, msg: ('error' in data && data.error) ? data.error : res.statusText, sev: 'error' });
                return;
            }

            setInviteLink(data.inviteUrl);
            setInviteExpiresAt(data.expiresAt);
            setSnack({ open: true, msg: 'Ссылка приглашения сгенерирована', sev: 'success' });

            // Очистка формы выбора пользователя (ссылку не трогаем)
            setSelectedUser(null);
            setUserQuery('');
            setInvEmail('');
            setInvRole('executor');

            await fetchMembers();
        } finally {
            setInviting(false);
        }
    }, [org, invEmail, invRole, canManage, fetchMembers]);

    const handleInviteClick = () => { void invite(); };
    const handleRefreshClick = () => { void fetchMembers(); };
    const handleCopyLink = () => {
        if (!inviteLink) return;
        void navigator.clipboard.writeText(inviteLink).then(() => {
            setSnack({ open: true, msg: 'Ссылка скопирована', sev: 'info' });
        });
    };

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

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
            <Typography variant="h5" sx={{ mb: 2 }}>
                Настройки организации: {orgName || org}
            </Typography>

            <Grid container spacing={2}>
                {/* Приглашение */}
                <Grid item xs={12} md={6}>
                    <Card variant="outlined">
                        <CardHeader title="Пригласить исполнителя" subheader="Сгенерируйте ссылку и отправьте её самостоятельно" />
                        <CardContent>
                            <Stack spacing={2}>
                                <Autocomplete<UserOption>
                                    options={userOpts}
                                    loading={userLoading}
                                    value={selectedUser}
                                    onChange={(_, val) => setSelectedUser(val)}
                                    inputValue={userQuery}
                                    onInputChange={(_, val) => setUserQuery(val)}
                                    freeSolo={false}
                                    autoHighlight
                                    filterOptions={(x) => x}
                                    getOptionLabel={(o) => o?.email ?? ''}
                                    isOptionEqualToValue={(opt, val) => opt.email === val.email}
                                    noOptionsText={userQuery ? 'Нет совпадений' : 'Начните вводить e-mail или имя'}
                                    renderOption={(props, option) => (
                                        <li {...props} key={option.email}>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Avatar src={option.profilePic} sx={{ width: 28, height: 28 }} />
                                                <Box>
                                                    <Typography variant="body2">{option.email}</Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {option.name || '—'}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </li>
                                    )}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="E-mail исполнителя"
                                            placeholder="worker@example.com"
                                            fullWidth
                                            InputProps={{
                                                ...params.InputProps,
                                                endAdornment: (
                                                    <>
                                                        {userLoading ? <CircularProgress size={16} /> : null}
                                                        {params.InputProps.endAdornment}
                                                    </>
                                                ),
                                            }}
                                        />
                                    )}
                                />

                                <FormControl fullWidth>
                                    <InputLabel>Роль</InputLabel>
                                    <Select
                                        label="Роль"
                                        value={invRole}
                                        onChange={(e) => setInvRole(e.target.value as OrgRole)}
                                    >
                                        <MenuItem value="executor">Executor</MenuItem>
                                        <MenuItem value="viewer">Viewer</MenuItem>
                                        <MenuItem value="manager">Manager</MenuItem>
                                        <MenuItem value="org_admin">Admin</MenuItem>
                                    </Select>
                                </FormControl>

                                {selectedUser && (
                                    <Typography variant="body2" color="text.secondary">
                                        Приглашаемый: <b>{selectedUser.name || '—'}</b>
                                    </Typography>
                                )}

                                <Stack direction="row" spacing={1}>
                                    <Button
                                        variant="contained"
                                        onClick={handleInviteClick}
                                        disabled={inviting || (!selectedUser && !invEmail)}
                                    >
                                        {inviting ? 'Создаём…' : 'Сгенерировать ссылку'}
                                    </Button>
                                </Stack>

                                {inviteLink && (
                                    <Alert severity="info" variant="outlined" sx={{ mt: 1 }}>
                                        <Stack spacing={1}>
                                            <Typography variant="body2">
                                                Ссылка приглашения (действует до{' '}
                                                {inviteExpiresAt ? new Date(inviteExpiresAt).toLocaleString() : '—'}
                                                ):
                                            </Typography>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <TextField
                                                    value={inviteLink}
                                                    InputProps={{ readOnly: true }}
                                                    fullWidth
                                                    size="small"
                                                />
                                                <Tooltip title="Скопировать ссылку">
                                                    <IconButton onClick={handleCopyLink}>
                                                        <ContentCopyIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </Stack>
                                    </Alert>
                                )}
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>

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
                                            {members.map((m) => (
                                                <TableRow key={m._id}>
                                                    <TableCell>{m.userName || '—'}</TableCell>
                                                    <TableCell>{m.userEmail}</TableCell>
                                                    <TableCell>{roleLabel(m.role)}</TableCell>
                                                    <TableCell>{statusChip(m.status)}</TableCell>
                                                    <TableCell align="right">
                                                        {m.status === 'invited' && (
                                                            <Tooltip title="Скопировать e-mail">
                                                                <IconButton
                                                                    onClick={() => {
                                                                        void navigator.clipboard.writeText(m.userEmail).then(() =>
                                                                            setSnack({ open: true, msg: 'E-mail скопирован', sev: 'info' })
                                                                        );
                                                                    }}
                                                                >
                                                                    <ContentCopyIcon fontSize="small" />
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
                                            ))}
                                            {members.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5}>
                                                        <Typography color="text.secondary">Участников пока нет.</Typography>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                    <Divider sx={{ my: 2 }} />
                                    <Typography variant="caption" color="text.secondary">
                                        Приглашения действуют 7 дней. Отправьте ссылку приглашённому вручную (мессенджер/почта).
                                    </Typography>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

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

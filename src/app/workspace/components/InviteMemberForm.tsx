//app/workspace/components/InviteMemberForm.tsx

'use client';

import * as React from 'react';
import {
    Box, Stack, TextField, Typography, FormControl, InputLabel, Select, MenuItem,
    Button, CircularProgress, Snackbar, Alert, IconButton, Tooltip, Avatar
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

type OrgRole = 'owner' | 'org_admin' | 'manager' | 'executor' | 'viewer';
type UserOption = { email: string; name?: string; profilePic?: string };

type Props = {
    org: string;
    defaultRole?: OrgRole;
};

export default function InviteMemberForm({ org, defaultRole = 'executor' }: Props) {
    const [userQuery, setUserQuery] = React.useState('');
    const [userOpts, setUserOpts] = React.useState<UserOption[]>([]);
    const [userLoading, setUserLoading] = React.useState(false);
    const [selectedUser, setSelectedUser] = React.useState<UserOption | null>(null);

    const [invRole, setInvRole] = React.useState<OrgRole>(defaultRole);
    const [inviting, setInviting] = React.useState(false);

    const [inviteLink, setInviteLink] = React.useState<string | null>(null);
    const [inviteExpiresAt, setInviteExpiresAt] = React.useState<string | null>(null);

    const [snack, setSnack] = React.useState<{ open: boolean; msg: string; sev: 'success'|'error'|'info' }>({
        open: false, msg: '', sev: 'success',
    });

    // автопоиск пользователей
    React.useEffect(() => {
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
    }, [org, userQuery]);

    const handleInvite = async () => {
        const email = selectedUser?.email?.trim();
        if (!email) {
            setSnack({ open: true, msg: 'Выберите пользователя (e-mail)', sev: 'error' });
            return;
        }
        setInviting(true);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/members/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userEmail: email, role: invRole }),
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

            // Сообщаем родителю через глобальное событие
            window.dispatchEvent(new CustomEvent('org-members:invited', {
                detail: { inviteUrl: data.inviteUrl, expiresAt: data.expiresAt, role: data.role }
            }));
        } finally {
            setInviting(false);
        }
    };

    const copyLink = async () => {
        if (!inviteLink) return;
        await navigator.clipboard.writeText(inviteLink);
        setSnack({ open: true, msg: 'Ссылка скопирована', sev: 'info' });
    };

    return (
        <Box>
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
                    renderInput={(params) => {
                        const { InputProps, ...rest } = params;
                        return (
                            <TextField
                                {...rest}
                                label="E-mail исполнителя"
                                placeholder="worker@example.com"
                                fullWidth
                                InputProps={{
                                    ...InputProps,
                                    endAdornment: (
                                        <>
                                            {userLoading ? <CircularProgress size={16} /> : null}
                                            {InputProps?.endAdornment}
                                        </>
                                    ),
                                }}
                            />
                        );
                    }}

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
                <Typography variant="caption" color="text.secondary">
                    Приглашение действует 7 дней.  Сгенерируйте ссылку и отправьте ее пользователю удобным для вас способом.
                </Typography>

                <Stack direction="row" spacing={1}>
                    <Button
                        variant="contained"
                        onClick={handleInvite}
                        disabled={inviting || !selectedUser}
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
                                    fullWidth
                                    size="small"
                                    slotProps={{ input: { readOnly: true } }}
                                />
                                <Tooltip title="Скопировать ссылку">
                                    <IconButton onClick={copyLink}>
                                        <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Stack>
                    </Alert>
                )}
            </Stack>

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

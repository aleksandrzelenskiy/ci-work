// app/workspace/components/InviteMemberForm.tsx

'use client';

import * as React from 'react';
import {
    Box,
    Stack,
    TextField,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    CircularProgress,
    Snackbar,
    Alert,
    Avatar,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';

type OrgRole = 'owner' | 'org_admin' | 'manager' | 'executor' | 'viewer';

type UserOption = {
    email: string;
    name?: string;
    profilePic?: string;
};

type Props = {
    org: string;
    defaultRole?: OrgRole;
    existingEmails?: string[];
};

export default function InviteMemberForm({
                                             org,
                                             defaultRole = 'executor',
                                             existingEmails = [],
                                         }: Props) {
    const [userQuery, setUserQuery] = React.useState('');
    const [userOpts, setUserOpts] = React.useState<UserOption[]>([]);
    const [userLoading, setUserLoading] = React.useState(false);
    const [selectedUser, setSelectedUser] = React.useState<UserOption | null>(null);

    const [invRole, setInvRole] = React.useState<OrgRole>(defaultRole);
    const [inviting, setInviting] = React.useState(false);

    const [snack, setSnack] = React.useState<{
        open: boolean;
        msg: string;
        sev: 'success' | 'error' | 'info';
    }>({
        open: false,
        msg: '',
        sev: 'success',
    });

    // сет для быстрых проверок
    const existingSet = React.useMemo(
        () => new Set(existingEmails.map((e) => e.toLowerCase())),
        [existingEmails]
    );

    // автопоиск пользователей
    React.useEffect(() => {
        const q = userQuery.trim();
        if (!q) {
            setUserOpts([]);
            return;
        }
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
            } catch {
                // игнорируем
            } finally {
                setUserLoading(false);
            }
        }, 250);

        return () => {
            clearTimeout(t);
            ctrl.abort();
        };
    }, [org, userQuery]);

    const selectedEmail = selectedUser?.email?.trim() || '';
    const emailAlreadyInOrg = selectedEmail
        ? existingSet.has(selectedEmail.toLowerCase())
        : false;

    const handleInvite = async () => {
        const email = selectedUser?.email?.trim();
        if (!email) {
            setSnack({ open: true, msg: 'Выберите пользователя (e-mail)', sev: 'error' });
            return;
        }
        if (existingSet.has(email.toLowerCase())) {
            setSnack({ open: true, msg: 'Этот e-mail уже есть в организации', sev: 'error' });
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
                setSnack({
                    open: true,
                    msg: 'error' in data && data.error ? data.error : res.statusText,
                    sev: 'error',
                });
                return;
            }

            setSnack({ open: true, msg: 'Приглашение отправлено', sev: 'success' });

            if (typeof window !== 'undefined') {
                window.dispatchEvent(
                    new CustomEvent('org-members:invited', {
                        detail: {
                            inviteUrl: data.inviteUrl,
                            expiresAt: data.expiresAt,
                            role: data.role,
                            userEmail: email,
                        },
                    })
                );
            }
        } finally {
            setInviting(false);
        }
    };

    const inviteeDisplayName = React.useMemo(() => {
        if (selectedUser?.name?.trim()) return selectedUser.name.trim();
        if (selectedUser?.email?.trim()) return selectedUser.email.trim();
        return null;
    }, [selectedUser]);

    return (
        <Box
            sx={{
                backgroundColor: 'rgba(255,255,255,0.65)',
                borderRadius: 3,
                border: '1px solid rgba(255,255,255,0.6)',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)',
                backdropFilter: 'blur(10px)',
                p: 2,
            }}
        >
            <Stack spacing={2}>
                <Autocomplete<UserOption, false, false, false>
                    options={userOpts}
                    loading={userLoading}
                    value={selectedUser}
                    onChange={(_, val) => setSelectedUser(val)}
                    inputValue={userQuery}
                    onInputChange={(_, val) => setUserQuery(val)}
                    autoHighlight
                    filterOptions={(x) => x}
                    getOptionLabel={(o) => o?.email ?? ''}
                    isOptionEqualToValue={(opt, val) => opt.email === val.email}
                    noOptionsText={userQuery ? 'Нет совпадений' : 'Начните вводить e-mail или имя'}
                    renderOption={(props, option) => {
                        // ВАЖНО: забираем key отдельно
                        const { key, ...liProps } = props as React.HTMLAttributes<HTMLLIElement> & { key?: string };
                        return (
                            <li key={key} {...liProps}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Avatar src={option.profilePic} sx={{ width: 28, height: 28 }} />
                                    <Box>
                                        <Typography variant="body2">{option.email}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {option.name || '—'}{' '}
                                            {existingSet.has(option.email.toLowerCase()) && (
                                                <Typography component="span" variant="caption" color="error">
                                                    уже в организации
                                                </Typography>
                                            )}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </li>
                        );
                    }}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="E-mail исполнителя"
                            placeholder="worker@example.com"
                            fullWidth
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: 'rgba(255,255,255,0.9)',
                                    borderRadius: 3,
                                },
                            }}
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

                <FormControl
                    fullWidth
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            borderRadius: 3,
                        },
                    }}
                >
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

                <Alert
                    severity="info"
                    sx={{
                        borderRadius: 3,
                        backgroundColor: 'rgba(255,255,255,0.85)',
                        color: 'rgba(2,6,23,0.8)',
                    }}
                >
                    Приглашение действует 7 дней. Приглашение будет направлено автоматически.{' '}
                    {inviteeDisplayName
                        ? `Пользователь ${inviteeDisplayName} получит уведомление.`
                        : 'Пользователь получит уведомление.'}
                </Alert>

                <Stack direction="row" spacing={1}>
                    <Button
                        variant="contained"
                        onClick={handleInvite}
                        disabled={inviting || !selectedUser || emailAlreadyInOrg}
                        sx={{
                            borderRadius: 999,
                            px: 3,
                            textTransform: 'none',
                            boxShadow: '0 10px 30px rgba(59,130,246,0.4)',
                        }}
                    >
                        {inviting ? 'Приглашаем…' : 'Пригласить'}
                    </Button>
                </Stack>
            </Stack>

            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
            >
                <Alert
                    onClose={() => setSnack((s) => ({ ...s, open: false }))}
                    severity={snack.sev}
                    variant="filled"
                >
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}

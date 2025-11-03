// src/app/org/[org]/join/page.tsx
'use client';

import * as React from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
    Box, Card, CardHeader, CardContent, Stack, Button, Typography,
    Snackbar, Alert, CircularProgress
} from '@mui/material';

type ApiOk = { ok: true };
type ApiErr = { error: string };
type ApiResp = ApiOk | ApiErr;

export default function OrgJoinPage() {
    // безопасно читаем org из params
    const params = useParams() as Record<string, string> | null;
    const org = params?.org ?? null;

    const sp = useSearchParams();
    const router = useRouter();

    const token = sp?.get('token') ?? null;

    const [snack, setSnack] = React.useState<{ open: boolean; msg: string; sev: 'success' | 'error' | 'info' }>({
        open: false, msg: '', sev: 'success'
    });
    const [loading, setLoading] = React.useState(false);

    const accept = React.useCallback(async () => {
        if (!org || !token) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/members/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const data = (await res.json().catch(() => ({}) as ApiErr)) as ApiResp;
            if (!res.ok || ('error' in data && data.error)) {
                const msg = ('error' in data && data.error) ? data.error : res.statusText;
                setSnack({ open: true, msg, sev: 'error' });
                return;
            }
            setSnack({ open: true, msg: 'Вы присоединились к организации', sev: 'success' });
            router.replace(`/org/${encodeURIComponent(org)}/projects`);
        } finally {
            setLoading(false);
        }
    }, [org, token, router]);

    const decline = React.useCallback(async () => {
        if (!org || !token) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(org)}/members/decline`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const data = (await res.json().catch(() => ({}) as ApiErr)) as ApiResp;
            if (!res.ok || ('error' in data && data.error)) {
                const msg = ('error' in data && data.error) ? data.error : res.statusText;
                setSnack({ open: true, msg, sev: 'error' });
                return;
            }
            setSnack({ open: true, msg: 'Приглашение отклонено', sev: 'success' });
            router.replace('/');
        } finally {
            setLoading(false);
        }
    }, [org, token, router]);

    return (
        <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 560, mx: 'auto' }}>
            <Card variant="outlined">
                <CardHeader title="Приглашение в организацию" />
                <CardContent>
                    {!token ? (
                        <Typography color="text.secondary">
                            Токен приглашения не найден. Проверьте ссылку у пригласившего.
                        </Typography>
                    ) : !org ? (
                        <Typography color="text.secondary">
                            Параметр организации отсутствует в URL.
                        </Typography>
                    ) : (
                        <Stack spacing={2}>
                            <Typography>
                                Пользователь вашей компании приглашает вас присоединиться к организации <b>{org}</b>.
                            </Typography>
                            <Typography color="text.secondary" variant="body2">
                                Нажмите «Присоединиться», чтобы стать участником. Если вы не ожидали это приглашение, нажмите «Отказаться».
                            </Typography>

                            <Stack direction="row" spacing={1}>
                                <Button variant="contained" onClick={() => void accept()} disabled={loading}>
                                    {loading ? <CircularProgress size={18} /> : 'Присоединиться'}
                                </Button>
                                <Button variant="outlined" onClick={() => void decline()} disabled={loading}>
                                    Отказаться
                                </Button>
                            </Stack>
                        </Stack>
                    )}
                </CardContent>
            </Card>

            <Snackbar
                open={snack.open}
                autoHideDuration={3000}
                onClose={() => setSnack(s => ({ ...s, open: false }))}
            >
                <Alert
                    onClose={() => setSnack(s => ({ ...s, open: false }))}
                    severity={snack.sev}
                    variant="filled"
                >
                    {snack.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
}

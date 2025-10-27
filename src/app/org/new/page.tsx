// src/app/org/new/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Paper, TextField, Typography, Alert, Stack } from '@mui/material';
import { useRouter } from 'next/navigation';

type CreateOrgSuccess = { ok: true; org: { slug: string } };
type CreateOrgError = { error: string };

// простая клиентская slugify (латиница/цифры/дефис, минимум 3 символа)
function makeSlug(input: string): string {
    return input
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 48);
}

export default function NewOrgPage() {
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [touchedSlug, setTouchedSlug] = useState(false); // если юзер редактировал slug вручную
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    // автогенерация slug из name, если пользователь не редактировал вручную
    useEffect(() => {
        if (!touchedSlug) {
            const s = makeSlug(name);
            setSlug(s);
        }
    }, [name, touchedSlug]);

    const slugError = useMemo(() => {
        if (!slug) return null;
        if (slug.length < 3) return 'Минимум 3 символа';
        if (!/^[a-z0-9-]+$/.test(slug)) return 'Разрешены только латиница, цифры, дефис';
        return null;
    }, [slug]);

    const handleCreate = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/org', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, slug: slug || undefined }),
            });

            const data: CreateOrgSuccess | CreateOrgError = await res.json();

            if (!res.ok || !('ok' in data) || !data.ok) {
                setError('error' in data ? data.error : 'Ошибка создания организации');
                return;
            }

            router.push(`/org/${data.org.slug}/projects`);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сети';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 520, mx: 'auto', mt: 4 }}>
            <Paper sx={{ p: 3 }}>
                <Typography variant="h5" fontWeight={700} gutterBottom>
                    Создать организацию
                </Typography>
                <Stack spacing={2}>
                    <TextField
                        label="Название организации"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        fullWidth
                    />
                    <TextField
                        label="Slug (URL-идентификатор)"
                        value={slug}
                        onChange={(e) => {
                            setTouchedSlug(true);
                            setSlug(makeSlug(e.target.value));
                        }}
                        helperText={slugError ?? 'Например: alpcenter'}
                        error={Boolean(slugError)}
                        fullWidth
                    />
                    {error && <Alert severity="error">{error}</Alert>}
                    <Button
                        onClick={() => void handleCreate()}
                        variant="contained"
                        disabled={loading || name.trim().length < 2 || Boolean(slugError)}
                    >
                        {loading ? 'Создаём…' : 'Создать'}
                    </Button>
                </Stack>
            </Paper>
        </Box>
    );
}

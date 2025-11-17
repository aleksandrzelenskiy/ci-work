'use client';

import {
    ChangeEvent,
    FormEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    Alert,
    Avatar,
    Box,
    Button,
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';

type ProfileResponse = {
    name: string;
    email: string;
    phone: string;
    profilePic: string;
    regionCode: string;
    error?: string;
};

type MessageState = { type: 'success' | 'error'; text: string } | null;

export default function ProfilePage() {
    const [profile, setProfile] = useState<ProfileResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState<MessageState>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');

    const deriveNames = useCallback((fullName?: string) => {
        const parts = (fullName ?? '')
            .split(' ')
            .map((chunk) => chunk.trim())
            .filter(Boolean);
        if (!parts.length) {
            setFirstName('');
            setLastName('');
            return;
        }
        setFirstName(parts[0] ?? '');
        setLastName(parts.slice(1).join(' '));
    }, []);

    const buildFullName = useCallback(
        (first?: string, last?: string) =>
            [first?.trim(), last?.trim()].filter(Boolean).join(' ').trim(),
        []
    );

    const loadProfile = useCallback(async () => {
        setLoading(true);
        setError(null);
        setMessage(null);
        try {
            const res = await fetch('/api/profile', { cache: 'no-store' });
            const data: ProfileResponse = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Не удалось загрузить профиль');
            }
            setProfile(data);
            deriveNames(data.name);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Неизвестная ошибка');
        } finally {
            setLoading(false);
        }
    }, [deriveNames]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!profile) return;
        setSaving(true);
        setMessage(null);

        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: buildFullName(firstName, lastName),
                    phone: profile.phone,
                    regionCode: profile.regionCode,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Не удалось обновить профиль');
            }
            if (data.profile) {
                setProfile((prev) =>
                    prev ? { ...prev, ...data.profile } : data.profile
                );
                deriveNames(data.profile.name);
            }
            setMessage({ type: 'success', text: 'Профиль обновлён' });
        } catch (err) {
            setMessage({
                type: 'error',
                text: err instanceof Error ? err.message : 'Неизвестная ошибка',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setMessage(null);
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            const res = await fetch('/api/profile/avatar', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Не удалось загрузить аватар');
            }
            setProfile((prev) =>
                prev ? { ...prev, profilePic: data.imageUrl } : prev
            );
            setMessage({ type: 'success', text: 'Аватар обновлён' });
        } catch (err) {
            setMessage({
                type: 'error',
                text: err instanceof Error ? err.message : 'Неизвестная ошибка',
            });
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    const triggerAvatarSelect = () => {
        fileInputRef.current?.click();
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || !profile) {
        return (
            <Box sx={{ p: 4, maxWidth: 640, mx: 'auto' }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error || 'Не удалось загрузить профиль'}
                </Alert>
                <Button variant="contained" onClick={loadProfile}>
                    Повторить попытку
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3, maxWidth: 720, mx: 'auto' }}>
            <Typography variant="h4" fontWeight={600} gutterBottom>
                Профиль пользователя
            </Typography>
            <Paper
                component="form"
                onSubmit={handleSubmit}
                sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}
            >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
                    <Avatar
                        src={profile.profilePic}
                        alt={profile.name}
                        sx={{ width: 120, height: 120 }}
                    />
                    <Box>
                        <Button
                            variant="outlined"
                            onClick={triggerAvatarSelect}
                            disabled={uploading}
                            sx={{ textTransform: 'none' }}
                        >
                            {uploading ? 'Загрузка...' : 'Изменить аватар'}
                        </Button>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                        >
                            JPG или PNG до 5 МБ
                        </Typography>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png, image/jpeg"
                            hidden
                            onChange={handleAvatarUpload}
                        />
                    </Box>
                </Stack>

                <TextField
                    label="Имя"
                    value={firstName}
                    onChange={(e) => {
                        const value = e.target.value;
                        setFirstName(value);
                        setProfile((prev) =>
                            prev
                                ? {
                                    ...prev,
                                    name: buildFullName(value, lastName),
                                }
                                : prev
                        );
                    }}
                    required
                />

                <TextField
                    label="Фамилия"
                    value={lastName}
                    onChange={(e) => {
                        const value = e.target.value;
                        setLastName(value);
                        setProfile((prev) =>
                            prev
                                ? {
                                    ...prev,
                                    name: buildFullName(firstName, value),
                                }
                                : prev
                        );
                    }}
                />

                <TextField
                    label="Телефон"
                    value={profile.phone}
                    onChange={(e) =>
                        setProfile((prev) =>
                            prev ? { ...prev, phone: e.target.value } : prev
                        )
                    }
                />

                <FormControl fullWidth>
                    <InputLabel id="profile-region-label">Регион</InputLabel>
                    <Select
                        labelId="profile-region-label"
                        label="Регион"
                        value={profile.regionCode}
                        onChange={(e) =>
                            setProfile((prev) =>
                                prev ? { ...prev, regionCode: e.target.value } : prev
                            )
                        }
                    >
                        {RUSSIAN_REGIONS.map((region) => (
                            <MenuItem key={region.code} value={region.code}>
                                {region.code} — {region.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <TextField label="Email" value={profile.email} disabled />

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={saving || uploading}
                    >
                        {saving ? <CircularProgress size={22} /> : 'Сохранить'}
                    </Button>
                    <Button
                        type="button"
                        variant="outlined"
                        onClick={loadProfile}
                        disabled={saving || uploading}
                    >
                        Обновить данные
                    </Button>
                </Box>

                {message && (
                    <Alert severity={message.type} onClose={() => setMessage(null)}>
                        {message.text}
                    </Alert>
                )}
            </Paper>
        </Box>
    );
}

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
    Chip,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';

type ProfileResponse = {
    name: string;
    email: string;
    phone: string;
    profilePic: string;
    regionCode: string;
    profileType?: 'employer' | 'contractor';
    skills?: string[];
    desiredRate?: number | null;
    bio?: string;
    portfolioLinks?: string[];
    portfolioStatus?: 'pending' | 'approved' | 'rejected';
    moderationComment?: string;
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
    const [skills, setSkills] = useState<string[]>([]);
    const [skillsInput, setSkillsInput] = useState('');
    const [desiredRate, setDesiredRate] = useState<string>('');
    const [bio, setBio] = useState('');
    const [portfolioLinks, setPortfolioLinks] = useState<string>('');

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
                setError(data.error || 'Не удалось загрузить профиль');
                return;
            }
            setProfile(data);
            deriveNames(data.name);
            setSkills(Array.isArray(data.skills) ? data.skills : []);
            setDesiredRate(
                typeof data.desiredRate === 'number'
                    ? String(data.desiredRate)
                    : ''
            );
            setBio(data.bio || '');
            setPortfolioLinks(
                Array.isArray(data.portfolioLinks)
                    ? data.portfolioLinks.join('\n')
                    : ''
            );
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
                    skills,
                    desiredRate: desiredRate.trim() ? Number(desiredRate.trim()) : null,
                    bio,
                    portfolioLinks: portfolioLinks
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setMessage({
                    type: 'error',
                    text: data.error || 'Не удалось обновить профиль',
                });
                return;
            }
            if (data.profile) {
                setProfile((prev) =>
                    prev ? { ...prev, ...data.profile } : data.profile
                );
                deriveNames(data.profile.name);
                setSkills(Array.isArray(data.profile.skills) ? data.profile.skills : []);
                setDesiredRate(
                    typeof data.profile.desiredRate === 'number'
                        ? String(data.profile.desiredRate)
                        : ''
                );
                setBio(data.profile.bio || '');
                setPortfolioLinks(
                    Array.isArray(data.profile.portfolioLinks)
                        ? data.profile.portfolioLinks.join('\n')
                        : ''
                );
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
                setMessage({
                    type: 'error',
                    text: data.error || 'Не удалось загрузить аватар',
                });
                return;
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

                {profile.profileType === 'contractor' && (
                    <Stack spacing={2}>
                        <Typography variant="h6" fontWeight={600}>
                            Профиль подрядчика
                        </Typography>
                        <Autocomplete<string, true, false, true>
                            multiple
                            freeSolo
                            options={[]}
                            value={skills}
                            inputValue={skillsInput}
                            onInputChange={(_e, val) => setSkillsInput(val)}
                            onChange={(_e, val) =>
                                setSkills(
                                    (val as string[]).map((v) => v.trim()).filter(Boolean)
                                )
                            }
                            renderTags={(value, getTagProps) =>
                                value.map((option, index) => (
                                    <Chip
                                        label={option}
                                        {...getTagProps({ index })}
                                        key={`${option}-${index}`}
                                        sx={{ borderRadius: 2 }}
                                    />
                                ))
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Навыки"
                                    placeholder="Оптика, электрика, сварка"
                                    helperText="Используется в выдаче публичных задач"
                                />
                            )}
                        />

                        <TextField
                            label="Ставка за задачу, ₽"
                            type="number"
                            value={desiredRate}
                            onChange={(e) => setDesiredRate(e.target.value)}
                            inputProps={{ min: 0 }}
                            helperText="Фиксированная ставка для типовых задач"
                        />

                        <TextField
                            label="О себе"
                            multiline
                            minRows={3}
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Кратко опишите опыт и специализацию"
                        />

                        <TextField
                            label="Портфолио/ссылки (по строке на ссылку)"
                            multiline
                            minRows={3}
                            value={portfolioLinks}
                            onChange={(e) => setPortfolioLinks(e.target.value)}
                            placeholder="https://site.com/example"
                        />

                        <Alert
                            severity={
                                profile.portfolioStatus === 'approved'
                                    ? 'success'
                                    : profile.portfolioStatus === 'rejected'
                                        ? 'error'
                                        : 'info'
                            }
                        >
                            Статус модерации: {profile.portfolioStatus || 'pending'}
                            {profile.moderationComment ? ` — ${profile.moderationComment}` : ''}
                        </Alert>
                    </Stack>
                )}

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

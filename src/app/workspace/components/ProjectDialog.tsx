import * as React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Autocomplete,
    Stack,
    Typography,
} from '@mui/material';
import TopicIcon from '@mui/icons-material/Topic';
import { RUSSIAN_REGIONS, REGION_MAP, REGION_ISO_MAP } from '@/app/utils/regions';
import { OPERATORS } from '@/app/utils/operators';

type OrgRole = 'owner' | 'org_admin' | 'manager' | 'executor' | 'viewer';

export type ProjectManagerOption = {
    email: string;
    name?: string;
    role?: OrgRole;
};

export type ProjectDialogValues = {
    projectId?: string;
    name: string;
    key: string;
    description?: string;
    regionCode: string;
    operator: string;
    managers: string[];
};

type Props = {
    open: boolean;
    mode: 'create' | 'edit';
    loading?: boolean;
    members: ProjectManagerOption[];
    initialData?: Partial<ProjectDialogValues>;
    onClose: () => void;
    onSubmit: (payload: ProjectDialogValues) => Promise<void> | void;
};

const REGION_LABEL = (code: string): string => {
    const region = RUSSIAN_REGIONS.find((item) => item.code === code);
    return region ? `${region.code} — ${region.label}` : code;
};

const REGION_OPTIONS = RUSSIAN_REGIONS;

const managerOptionLabel = (option: ProjectManagerOption) => {
    if (option.name && option.email) {
        return `${option.name} (${option.email})`;
    }
    return option.email;
};

export default function ProjectDialog({
    open,
    mode,
    loading = false,
    members,
    initialData,
    onClose,
    onSubmit,
}: Props) {
    const [name, setName] = React.useState('');
    const [key, setKey] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [regionCode, setRegionCode] = React.useState<string>(REGION_OPTIONS[0]?.code ?? '');
    const [operator, setOperator] = React.useState<string>('');
    const [managerOptions, setManagerOptions] = React.useState<ProjectManagerOption[]>([]);
    const [selectedManagers, setSelectedManagers] = React.useState<ProjectManagerOption[]>([]);
    const [submitting, setSubmitting] = React.useState(false);

    React.useEffect(() => {
        setManagerOptions(members);
    }, [members]);

    const resolveRegionCode = React.useCallback((code?: string | null): string => {
        if (!code) return '';
        if (REGION_MAP.has(code)) return code;
        const match = REGION_ISO_MAP.get(code);
        if (match) return match.code;
        return '';
    }, []);

    const resolveRegionOption = React.useCallback(
        (code?: string | null) => {
            const resolvedCode = resolveRegionCode(code);
            if (!resolvedCode) return null;
            return REGION_OPTIONS.find((option) => option.code === resolvedCode) ?? null;
        },
        [resolveRegionCode]
    );

    React.useEffect(() => {
        if (!open) return;
        setName(initialData?.name ?? '');
        setKey(initialData?.key ?? '');
        setDescription(initialData?.description ?? '');
        const normalizedRegion = resolveRegionCode(initialData?.regionCode);
        const fallbackRegion = REGION_OPTIONS[0]?.code ?? '';
        setRegionCode(normalizedRegion || fallbackRegion);
        setOperator(initialData?.operator ?? '');

        const initialManagers = Array.isArray(initialData?.managers) ? initialData?.managers : [];
        const resolved = initialManagers.map((email) => {
            const option = members.find((item) => item.email === email);
            return option ?? { email };
        });
        setSelectedManagers(resolved);
    }, [open, initialData, members, resolveRegionCode]);

    const isCreate = mode === 'create';
    const busy = submitting || loading;
    const isSubmitDisabled = !name.trim() || !key.trim() || !regionCode || !operator || busy;
    const glassInputSx = {
        '& .MuiOutlinedInput-root': {
            backgroundColor: 'rgba(255,255,255,0.92)',
            borderRadius: 3,
            '& fieldset': { borderColor: 'rgba(255,255,255,0.6)' },
            '&:hover fieldset': { borderColor: 'rgba(147,197,253,0.9)' },
            '&.Mui-focused fieldset': { borderColor: 'rgba(59,130,246,0.8)' },
        },
    };

    const handleSubmit = async () => {
        if (isSubmitDisabled) return;
        setSubmitting(true);
        try {
            const payload: ProjectDialogValues = {
                projectId: initialData?.projectId,
                name: name.trim(),
                key: key.trim(),
                description: description.trim(),
                regionCode,
                operator,
                managers: Array.from(
                    new Set(
                        selectedManagers
                            .map((option) => option.email?.trim().toLowerCase())
                            .filter((email): email is string => Boolean(email))
                    )
                ),
            };
            await onSubmit(payload);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={busy ? undefined : onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    backdropFilter: 'blur(28px)',
                    backgroundColor: 'rgba(255,255,255,0.85)',
                    border: '1px solid rgba(255,255,255,0.4)',
                    borderRadius: 4,
                    boxShadow: '0 40px 80px rgba(15,23,42,0.25)',
                },
            }}
        >
            <DialogTitle
                sx={{
                    background: 'linear-gradient(120deg, rgba(255,255,255,0.95), rgba(243,244,255,0.85))',
                    borderBottom: '1px solid rgba(255,255,255,0.4)',
                    fontWeight: 600,
                }}
            >
                <Stack direction="row" spacing={1.5} alignItems="center">
                    {isCreate && <TopicIcon color="primary" />}
                    <span>{isCreate ? 'Новый проект' : 'Редактировать проект'}</span>
                </Stack>
            </DialogTitle>
            <DialogContent
                dividers
                sx={{
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,250,255,0.8))',
                }}
            >
                <TextField
                    label="Название"
                    fullWidth
                    sx={{ mt: 1, ...glassInputSx }}
                    value={name}
                    disabled={busy}
                    onChange={(e) => setName(e.target.value)}
                />
                <TextField
                    label="Код (KEY)"
                    fullWidth
                    sx={{ mt: 2, ...glassInputSx }}
                    value={key}
                    disabled={busy}
                    onChange={(e) => setKey(e.target.value)}
                />
                <TextField
                    label="Описание"
                    fullWidth
                    multiline
                    minRows={3}
                    sx={{ mt: 2, ...glassInputSx }}
                    value={description}
                    disabled={busy}
                    onChange={(e) => setDescription(e.target.value)}
                />
                <Box sx={{ mt: 3 }}>
                    <Autocomplete
                        options={REGION_OPTIONS}
                        value={resolveRegionOption(regionCode)}
                        onChange={(_, value) => setRegionCode(value?.code ?? '')}
                        getOptionLabel={(option) => REGION_LABEL(option.code)}
                        renderOption={(props, option) => (
                            <li {...props} key={option.code}>
                                <Typography>{REGION_LABEL(option.code)}</Typography>
                            </li>
                        )}
                        disabled={busy}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Регион (код — название)"
                                sx={glassInputSx}
                            />
                        )}
                    />
                </Box>
                <Box sx={{ mt: 2 }}>
                    <Autocomplete
                        options={OPERATORS}
                        value={OPERATORS.find((item) => item.value === operator) ?? null}
                        onChange={(_, value) => setOperator(value?.value ?? '')}
                        getOptionLabel={(option) => option.label}
                        disabled={busy}
                        renderInput={(params) => (
                            <TextField {...params} label="Оператор" sx={glassInputSx} />
                        )}
                    />
                </Box>
                <Box sx={{ mt: 2 }}>
                    <Autocomplete
                        multiple
                        options={managerOptions}
                        value={selectedManagers}
                        getOptionLabel={managerOptionLabel}
                        isOptionEqualToValue={(option, value) => option.email === value.email}
                        disabled={busy}
                        onChange={(_, value) => setSelectedManagers(value)}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Менеджеры проекта"
                                placeholder="Выберите участников"
                                sx={glassInputSx}
                            />
                        )}
                        renderOption={(props, option) => (
                            <li {...props} key={option.email}>
                                <Stack>
                                    <Typography>{managerOptionLabel(option)}</Typography>
                                    {option.role && (
                                        <Typography variant="caption" color="text.secondary">
                                            Роль: {option.role}
                                        </Typography>
                                    )}
                                </Stack>
                            </li>
                        )}
                    />
                </Box>
            </DialogContent>
            <DialogActions
                sx={{
                    backgroundColor: 'rgba(255,255,255,0.85)',
                    borderTop: '1px solid rgba(255,255,255,0.4)',
                }}
            >
                <Button onClick={onClose} disabled={busy} sx={{ borderRadius: 999, px: 2 }}>
                    Отмена
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={isSubmitDisabled}
                    sx={{
                        borderRadius: 999,
                        px: 3,
                        textTransform: 'none',
                        boxShadow: '0 15px 35px rgba(59,130,246,0.45)',
                    }}
                >
                    {isCreate ? 'Создать' : 'Сохранить'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

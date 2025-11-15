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
        <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{isCreate ? 'Новый проект' : 'Редактировать проект'}</DialogTitle>
            <DialogContent dividers>
                <TextField
                    label="Название"
                    fullWidth
                    sx={{ mt: 1 }}
                    value={name}
                    disabled={busy}
                    onChange={(e) => setName(e.target.value)}
                />
                <TextField
                    label="Код (KEY)"
                    fullWidth
                    sx={{ mt: 2 }}
                    value={key}
                    disabled={busy}
                    onChange={(e) => setKey(e.target.value)}
                />
                <TextField
                    label="Описание"
                    fullWidth
                    multiline
                    minRows={3}
                    sx={{ mt: 2 }}
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
                            <TextField {...params} label="Регион (код — название)" />
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
                        renderInput={(params) => <TextField {...params} label="Оператор" />}
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
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>
                    Отмена
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={isSubmitDisabled}
                >
                    {isCreate ? 'Создать' : 'Сохранить'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

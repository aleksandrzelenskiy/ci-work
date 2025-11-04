// src/app/workspace/components/WorkspaceTaskDialog.tsx
'use client';

import * as React from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Stack,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress,
    Avatar,
    ListItemText,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

type Props = {
    open: boolean;
    org: string;
    /** Ключ проекта (например, "T2-IR"), а не ObjectId */
    project: string;
    onCloseAction: () => void;
    onCreatedAction: () => void;
};

type Priority = 'urgent' | 'high' | 'medium' | 'low';

/** Опция автокомплита: любой активный участник организации */
type MemberOption = {
    id: string;          // _id membership/user
    name: string;        // userName || userEmail
    email: string;
    profilePic?: string; // <— используем profilePic, как на бэке
};

type MembersApi = {
    members: Array<{
        _id: string;
        userName?: string;
        userEmail: string;
        profilePic?: string; // <— тут тоже profilePic
    }>;
    error?: string;
};

// cspell:disable-next-line — намеренно без I и O
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genId(len = 5) {
    let s = '';
    for (let i = 0; i < len; i++) s += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
    return s;
}

export default function WorkspaceTaskDialog({
                                                open,
                                                org,
                                                project,
                                                onCloseAction,
                                                onCreatedAction,
                                            }: Props) {
    const [saving, setSaving] = React.useState(false);
    const [taskName, setTaskName] = React.useState('');
    const [bsNumber, setBsNumber] = React.useState('');
    const [bsAddress, setBsAddress] = React.useState('');
    const [priority, setPriority] = React.useState<Priority>('medium');
    const [dueDate, setDueDate] = React.useState<Date | null>(new Date());

    // Координаты
    const [bsLatitude, setBsLatitude] = React.useState<string>('');
    const [bsLongitude, setBsLongitude] = React.useState<string>('');

    // Исполнитель = любой активный участник
    const [members, setMembers] = React.useState<MemberOption[]>([]);
    const [membersLoading, setMembersLoading] = React.useState(false);
    const [membersError, setMembersError] = React.useState<string | null>(null);
    const [selectedExecutor, setSelectedExecutor] = React.useState<MemberOption | null>(null);

    // загрузка активных участников при открытии диалога
    React.useEffect(() => {
        if (!open) return;
        let aborted = false;

        async function loadMembers(): Promise<void> {
            setMembersLoading(true);
            setMembersError(null);
            try {
                const res = await fetch(
                    `/api/org/${encodeURIComponent(org)}/members?status=active`,
                    { method: 'GET', headers: { 'Content-Type': 'application/json' }, cache: 'no-store' }
                );
                const j = (await res.json().catch(() => ({}))) as MembersApi | { error?: string };

                if (!res.ok) {
                    setMembersError((j as { error?: string })?.error || res.statusText);
                    return;
                }

                const list = (j as MembersApi)?.members ?? [];
                const opts: MemberOption[] = list.map((m) => ({
                    id: String(m._id),
                    name: m.userName || m.userEmail,
                    email: m.userEmail,
                    profilePic: m.profilePic,
                }));

                if (!aborted) setMembers(opts);
            } catch (e) {
                if (!aborted) setMembersError(e instanceof Error ? e.message : 'Failed to load members');
            } finally {
                if (!aborted) setMembersLoading(false);
            }
        }

        void loadMembers();
        return () => {
            aborted = true;
        };
    }, [open, org]);

    const isLatValid =
        bsLatitude === '' ||
        (!Number.isNaN(Number(bsLatitude)) &&
            Number.isFinite(Number(bsLatitude)) &&
            Number(bsLatitude) >= -90 &&
            Number(bsLatitude) <= 90);

    const isLngValid =
        bsLongitude === '' ||
        (!Number.isNaN(Number(bsLongitude)) &&
            Number.isFinite(Number(bsLongitude)) &&
            Number(bsLongitude) >= -180 &&
            Number(bsLongitude) <= 180);

    const reset = () => {
        setTaskName('');
        setBsNumber('');
        setBsAddress('');
        setPriority('medium');
        setDueDate(new Date());
        setBsLatitude('');
        setBsLongitude('');
        setSelectedExecutor(null);
    };

    const handleClose = () => {
        if (saving) return;
        reset();
        onCloseAction();
    };

    const handleCreate = async () => {
        if (!taskName || !bsNumber) return;
        if (!isLatValid || !isLngValid) return;

        setSaving(true);
        try {
            const payload = {
                taskId: genId(),
                taskName,
                bsNumber,
                bsAddress,
                status: 'To do', // совпадает с enum модели
                priority,
                dueDate: dueDate ? dueDate.toISOString() : undefined,

                bsLatitude: bsLatitude === '' ? undefined : Number(bsLatitude),
                bsLongitude: bsLongitude === '' ? undefined : Number(bsLongitude),

                // Исполнитель (если выбран)
                executorId: selectedExecutor?.id,
                executorName: selectedExecutor?.name,
                executorEmail: selectedExecutor?.email,
            };

            const res = await fetch(
                `/api/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(project)}/tasks`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            );

            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                console.error('Failed to create task:', (j as { error?: string })?.error || res.statusText);
                return;
            }

            reset();
            onCreatedAction();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
                <DialogTitle>Создать задачу</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="Task Name"
                            value={taskName}
                            onChange={(e) => setTaskName(e.target.value)}
                            required
                            fullWidth
                        />

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                label="BS Number"
                                value={bsNumber}
                                onChange={(e) => setBsNumber(e.target.value)}
                                required
                                fullWidth
                            />
                            <TextField
                                label="BS Address"
                                value={bsAddress}
                                onChange={(e) => setBsAddress(e.target.value)}
                                fullWidth
                            />
                        </Stack>

                        {/* Координаты БС — WGS-84 Decimal Degrees */}
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                label="Latitude (Широта)"
                                type="number"
                                value={bsLatitude}
                                onChange={(e) => setBsLatitude(e.target.value)}
                                error={!isLatValid}
                                placeholder="напр. 52.270889"
                                helperText={
                                    !isLatValid
                                        ? 'Широта должна быть в диапазоне −90…90'
                                        : 'WGS-84, десятичные градусы (lat), точка как разделитель'
                                }
                                fullWidth
                                slotProps={{
                                    input: { inputProps: { step: 'any', min: -90, max: 90 } },
                                }}
                            />

                            <TextField
                                label="Longitude (Долгота)"
                                type="number"
                                value={bsLongitude}
                                onChange={(e) => setBsLongitude(e.target.value)}
                                error={!isLngValid}
                                placeholder="напр. 104.599610"
                                helperText={
                                    !isLngValid
                                        ? 'Долгота должна быть в диапазоне −180…180'
                                        : 'WGS-84, десятичные градусы (lon), точка как разделитель'
                                }
                                fullWidth
                                slotProps={{
                                    input: { inputProps: { step: 'any', min: -180, max: 180 } },
                                }}
                            />
                        </Stack>

                        {/* Исполнитель: любой активный участник (Autocomplete) */}
                        <Autocomplete<MemberOption>
                            options={members}
                            value={selectedExecutor}
                            onChange={(_e, val) => setSelectedExecutor(val)}
                            getOptionLabel={(opt) => opt?.name || opt?.email || ''}
                            loading={membersLoading}
                            noOptionsText={
                                membersError
                                    ? `Ошибка: ${membersError}`
                                    : 'Нет активных участников'
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Исполнитель (любой активный участник)"
                                    placeholder={membersLoading ? 'Загрузка...' : 'Начните вводить имя или email'}
                                    fullWidth
                                    // стандартный способ показать спиннер в Autocomplete
                                    InputProps={{
                                        ...params.InputProps,
                                        endAdornment: (
                                            <>
                                                {membersLoading ? <CircularProgress size={18} style={{ marginRight: 8 }} /> : null}
                                                {params.InputProps.endAdornment}
                                            </>
                                        ),
                                    }}
                                />
                            )}
                            renderOption={(props, option) => (
                                <li {...props} key={option.id}>
                                    <Avatar
                                        src={option.profilePic}
                                        alt={option.name}
                                        sx={{ width: 24, height: 24, mr: 1 }}
                                    >
                                        {(option.name || option.email)?.[0]?.toUpperCase() ?? 'U'}
                                    </Avatar>
                                    <ListItemText primary={option.name} secondary={option.email} />
                                </li>
                            )}
                            isOptionEqualToValue={(opt, val) => opt.id === val.id}
                        />

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <FormControl fullWidth>
                                <InputLabel>Priority</InputLabel>
                                <Select
                                    label="Priority"
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value as Priority)}
                                >
                                    <MenuItem value="urgent">Urgent</MenuItem>
                                    <MenuItem value="high">High</MenuItem>
                                    <MenuItem value="medium">Medium</MenuItem>
                                    <MenuItem value="low">Low</MenuItem>
                                </Select>
                            </FormControl>

                            <DatePicker
                                label="Due Date"
                                value={dueDate}
                                onChange={(d) => setDueDate(d)}
                                slotProps={{ textField: { fullWidth: true } }}
                            />
                        </Stack>
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button onClick={handleClose} disabled={saving}>
                        Отмена
                    </Button>
                    <Button
                        onClick={handleCreate}
                        variant="contained"
                        disabled={
                            saving || !taskName || !bsNumber || !isLatValid || !isLngValid
                        }
                    >
                        Создать
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
}

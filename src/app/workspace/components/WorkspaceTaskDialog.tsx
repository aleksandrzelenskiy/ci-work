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
    ListItemIcon,
    ListItemText,
} from '@mui/material';
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

type ExecutorDTO = {
    id: string;           // внутренний id/uuid участника
    name: string;         // отображаемое имя
    email: string;        // рабочий email
    avatarUrl?: string;   // аватар (опционально)
};

// noinspection SpellCheckingInspection
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

    // Исполнители
    const [executors, setExecutors] = React.useState<ExecutorDTO[]>([]);
    const [executorsLoading, setExecutorsLoading] = React.useState(false);
    const [executorsError, setExecutorsError] = React.useState<string | null>(null);
    const [selectedExecutorId, setSelectedExecutorId] = React.useState<string>('');

    // загрузка списка исполнителей при открытии диалога
    React.useEffect(() => {
        if (!open) return;
        let aborted = false;

        async function loadExecutors() {
            setExecutorsLoading(true);
            setExecutorsError(null);
            try {
                // ОЖИДАЕМЫЙ эндпоинт: вернёт только участников с ролью "executor"
                // Формат ответа:
                // { members: Array<{ id, name, email, avatarUrl? }> }
                const res = await fetch(`/api/org/${encodeURIComponent(org)}/members?role=executor`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    cache: 'no-store',
                });
                if (!res.ok) {
                    const j = await res.json().catch(() => ({}));
                    throw new Error(j.error || res.statusText);
                }
                const data = await res.json();
                if (!aborted) {
                    setExecutors(Array.isArray(data?.members) ? data.members : []);
                }
            } catch (e: unknown) {
                if (!aborted) {
                    setExecutorsError(e instanceof Error ? e.message : 'Failed to load executors');
                }
            } finally {
                if (!aborted) setExecutorsLoading(false);
            }
        }

        loadExecutors();
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
        setSelectedExecutorId('');
    };

    const handleClose = () => {
        if (saving) return;
        reset();
        onCloseAction();
    };

    const handleCreate = async () => {
        if (!taskName || !bsNumber) return;
        if (!isLatValid || !isLngValid) return;

        // найдём выбранного исполнителя по id (если выбран)
        const sel = executors.find((m) => m.id === selectedExecutorId);

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
                // координаты — числа, если введены
                bsLatitude: bsLatitude === '' ? undefined : Number(bsLatitude),
                bsLongitude: bsLongitude === '' ? undefined : Number(bsLongitude),

                // привязка исполнителя (минимальный набор полей под твою модель)
                executorId: sel?.id,
                executorName: sel?.name,
                executorEmail: sel?.email,
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
                console.error('Failed to create task:', j.error || res.statusText);
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
                                inputProps={{ step: 'any', min: -90, max: 90 }}
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
                            />
                            <TextField
                                label="Longitude (Долгота)"
                                type="number"
                                inputProps={{ step: 'any', min: -180, max: 180 }}
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
                            />
                        </Stack>

                        {/* Исполнитель (роль executor) */}
                        <FormControl fullWidth>
                            <InputLabel id="executor-label">Исполнитель</InputLabel>
                            <Select
                                labelId="executor-label"
                                label="Исполнитель"
                                value={selectedExecutorId}
                                onChange={(e) => setSelectedExecutorId(e.target.value as string)}
                                disabled={executorsLoading}
                                renderValue={(val) => {
                                    const sel = executors.find((m) => m.id === val);
                                    return sel ? sel.name : '';
                                }}
                            >
                                {executorsLoading && (
                                    <MenuItem disabled>
                                        <ListItemIcon>
                                            <CircularProgress size={18} />
                                        </ListItemIcon>
                                        <ListItemText primary="Загрузка..." />
                                    </MenuItem>
                                )}
                                {executorsError && !executorsLoading && (
                                    <MenuItem disabled>
                                        <ListItemText primary={`Ошибка: ${executorsError}`} />
                                    </MenuItem>
                                )}
                                {!executorsLoading && !executorsError && executors.length === 0 && (
                                    <MenuItem disabled>
                                        <ListItemText primary="Нет пользователей с ролью executor" />
                                    </MenuItem>
                                )}
                                {executors.map((m) => (
                                    <MenuItem key={m.id} value={m.id}>
                                        {m.avatarUrl ? (
                                            <ListItemIcon>
                                                <Avatar src={m.avatarUrl} alt={m.name} sx={{ width: 24, height: 24 }} />
                                            </ListItemIcon>
                                        ) : (
                                            <ListItemIcon>
                                                <Avatar sx={{ width: 24, height: 24 }}>{m.name?.[0] ?? 'U'}</Avatar>
                                            </ListItemIcon>
                                        )}
                                        <ListItemText primary={m.name} secondary={m.email} />
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

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
                        disabled={saving || !taskName || !bsNumber || !isLatValid || !isLngValid}
                    >
                        Создать
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
}

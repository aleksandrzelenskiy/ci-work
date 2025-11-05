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
    Chip,
    IconButton,
    Typography,
    LinearProgress,
    Tooltip,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

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
    profilePic?: string; // profilePic как на бэке
};

type MembersApi = {
    members: Array<{
        _id: string;
        userName?: string;
        userEmail: string;
        profilePic?: string;
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
    const [taskDescription, setTaskDescription] = React.useState('');
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

    // Вложения (drag & drop)
    const [attachments, setAttachments] = React.useState<File[]>([]);
    const [dragActive, setDragActive] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState<number>(0);

    /** Универсальный извлекатель текстовой ошибки из JSON-ответа */
    function extractErrorMessage(payload: unknown, fallback: string): string {
        const err = (payload as { error?: unknown })?.error;
        return typeof err === 'string' && err.trim() ? err : fallback;
    }

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

                let body: unknown = null;
                try { body = await res.json(); } catch { /* может не быть тела */ }

                if (!res.ok) {
                    if (!aborted) setMembersError(extractErrorMessage(body, res.statusText));
                    return;
                }

                const list = (body as MembersApi)?.members ?? [];
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
        setTaskDescription('');
        setPriority('medium');
        setDueDate(new Date());
        setBsLatitude('');
        setBsLongitude('');
        setSelectedExecutor(null);
        setAttachments([]);
        setUploadProgress(0);
        setUploading(false);
    };

    const handleClose = () => {
        if (saving || uploading) return;
        reset();
        onCloseAction();
    };

    // ---------- Drag & Drop ----------
    const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
    };
    const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
    };
    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const files = Array.from(e.dataTransfer.files || []);
        if (!files.length) return;
        addFiles(files);
    };

    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const openFileDialog = () => inputRef.current?.click();

    const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        addFiles(files);
        // сбрасываем value, чтобы одно и то же имя можно было выбрать снова
        e.currentTarget.value = '';
    };

    const addFiles = (files: File[]) => {
        // простая фильтрация дубликатов по имени+size (можно усложнить до hash)
        const existing = new Set(attachments.map(f => `${f.name}:${f.size}`));
        const toAdd = files.filter(f => !existing.has(`${f.name}:${f.size}`));
        setAttachments(prev => [...prev, ...toAdd]);
    };

    const removeFile = (name: string, size: number) => {
        setAttachments(prev => prev.filter(f => !(f.name === name && f.size === size)));
    };

    // ---------- Upload attachments (после создания задачи) ----------
    async function uploadAttachments(taskId: string): Promise<void> {
        if (!attachments.length) return;
        setUploading(true);
        setUploadProgress(0);

        // грузим по одному файлу, чтобы легче трекать прогресс
        for (let i = 0; i < attachments.length; i++) {
            const file = attachments[i];
            const fd = new FormData();
            fd.append('file', file, file.name);
            fd.append('taskId', taskId);
            fd.append('subfolder', 'attachments'); // важно для вашей s3-утилиты
            fd.append('orgSlug', org);             // если на сервере понадобится путь {org}/{task}

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: fd,
                // без Content-Type — браузер сам поставит multipart/form-data с boundary
            });

            if (!res.ok) {
                // логируем, но не падаем — грузим остальные
                let body: unknown = null;
                try { body = await res.json(); } catch { /* ignore JSON parse error */ }
                const errText = extractErrorMessage(body, res.statusText);
                console.error('File upload failed:', errText);
            }

            setUploadProgress(Math.round(((i + 1) / attachments.length) * 100));
        }

        setUploading(false);
    }

    const handleCreate = async () => {
        if (!taskName || !bsNumber) return;
        if (!isLatValid || !isLngValid) return;

        setSaving(true);
        const newTaskId = genId();

        try {
            const payload = {
                taskId: newTaskId,
                taskName,
                bsNumber,
                bsAddress,
                taskDescription: taskDescription?.trim() || undefined,
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
                let body: unknown = null;
                try { body = await res.json(); } catch { /* ignore */ }
                const createErr = extractErrorMessage(body, res.statusText);
                console.error('Failed to create task:', createErr);
                return;
            }

            // сначала создали задачу — потом грузим вложения, используя тот же taskId
            await uploadAttachments(newTaskId);

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

                        {/* Описание задачи — свободный текст */}
                        <TextField
                            label="Описание задачи"
                            value={taskDescription}
                            onChange={(e) => setTaskDescription(e.target.value)}
                            multiline
                            minRows={3}
                            maxRows={10}
                            placeholder="Что сделать, детали, входные данные, ссылки и пр."
                            fullWidth
                        />

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
                                    label="Исполнитель (участники организации)"
                                    placeholder={membersLoading ? 'Загрузка...' : 'Начните вводить имя или email'}
                                    fullWidth
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

                        {/* ---------- Drag & Drop attachments ---------- */}
                        <Box
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                            sx={{
                                border: '2px dashed',
                                borderColor: dragActive ? 'primary.main' : 'divider',
                                borderRadius: 2,
                                p: 2,
                                textAlign: 'center',
                                cursor: 'pointer',
                                bgcolor: dragActive ? 'action.hover' : 'transparent',
                                transition: 'all 120ms ease',
                            }}
                            onClick={openFileDialog}
                        >
                            <CloudUploadIcon sx={{ fontSize: 36, mb: 1 }} />
                            <Typography variant="body1">
                                Перетащите файлы сюда или нажмите для выбора
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Вложения будут сохранены как <b>attachments</b> этой задачи
                            </Typography>
                            <input
                                ref={inputRef}
                                type="file"
                                multiple
                                hidden
                                onChange={onFileInputChange}
                            />
                        </Box>

                        {!!attachments.length && (
                            <Box>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                    <Typography variant="subtitle2">
                                        Вложения: {attachments.length}
                                    </Typography>
                                    {uploading && (
                                        <>
                                            <LinearProgress variant="determinate" value={uploadProgress} sx={{ flex: 1 }} />
                                            <Typography variant="caption" sx={{ minWidth: 36, textAlign: 'right' }}>
                                                {uploadProgress}%
                                            </Typography>
                                        </>
                                    )}
                                </Stack>

                                <Stack direction="row" flexWrap="wrap" gap={1}>
                                    {attachments.map((f) => (
                                        <Chip
                                            key={`${f.name}:${f.size}`}
                                            label={`${f.name} (${Math.round(f.size / 1024)} KB)`}
                                            onDelete={!saving && !uploading ? () => removeFile(f.name, f.size) : undefined}
                                            deleteIcon={
                                                <Tooltip title="Удалить">
                                                    <IconButton size="small" edge="end">
                                                        <DeleteOutlineIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            }
                                            sx={{ maxWidth: '100%' }}
                                        />
                                    ))}
                                </Stack>
                            </Box>
                        )}
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button onClick={handleClose} disabled={saving || uploading}>
                        Отмена
                    </Button>
                    <Button
                        onClick={handleCreate}
                        variant="contained"
                        disabled={
                            saving || uploading || !taskName || !bsNumber || !isLatValid || !isLngValid
                        }
                    >
                        Создать
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
}

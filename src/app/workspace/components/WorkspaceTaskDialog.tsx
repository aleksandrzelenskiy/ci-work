// src/app/workspace/components/WorkspaceTaskDialog.tsx
'use client';

import * as React from 'react';
import {
    Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Stack,
    FormControl, InputLabel, Select, MenuItem, CircularProgress, Avatar, ListItemText,
    Chip, IconButton, Typography, LinearProgress, Tooltip,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

type Priority = 'urgent' | 'high' | 'medium' | 'low';

type MemberOption = {
    id: string;
    name: string;
    email: string;
    profilePic?: string;
};

type MembersApi = {
    members: Array<{ _id: string; userName?: string; userEmail: string; profilePic?: string }>;
    error?: string;
};

export type TaskForEdit = {
    _id: string;
    taskId: string;
    taskName: string;
    status?: string;
    dueDate?: string;
    bsNumber?: string;
    bsAddress?: string;
    taskDescription?: string;
    bsLatitude?: number;
    bsLongitude?: number;
    totalCost?: number;
    priority?: Priority | string;
    executorId?: string;
    executorName?: string;
    executorEmail?: string;
    /** Если сервер уже отдаёт список файлов — покажем его */
    files?: Array<{ name?: string; url?: string; size?: number }>;
};

type Props = {
    open: boolean;
    org: string;
    /** Ключ проекта (например, "T2-IR"), а не ObjectId */
    project: string;
    onCloseAction: () => void;
    onCreatedAction: () => void;
    mode?: 'create' | 'edit';
    initialTask?: TaskForEdit | null;
};

// cspell:disable-next-line — намеренно без I и O
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genId(len = 5) {
    let s = '';
    for (let i = 0; i < len; i++) s += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
    return s;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
    const err = (payload as { error?: unknown })?.error;
    return typeof err === 'string' && err.trim() ? err : fallback;
}

export default function WorkspaceTaskDialog({
                                                open,
                                                org,
                                                project,
                                                onCloseAction,
                                                onCreatedAction,
                                                mode = 'create',
                                                initialTask = null,
                                            }: Props) {
    const isEdit = mode === 'edit';

    // нормализованные org/project
    const orgSlug = React.useMemo(() => org?.trim(), [org]);
    const projectRef = React.useMemo(() => project?.trim(), [project]);
    const apiPath = React.useCallback(
        (path: string) => {
            if (!orgSlug) throw new Error('org is required');
            return `/api/org/${encodeURIComponent(orgSlug)}${path}`;
        },
        [orgSlug]
    );

    const [saving, setSaving] = React.useState(false);

    const [taskName, setTaskName] = React.useState('');
    const [bsNumber, setBsNumber] = React.useState('');
    const [bsAddress, setBsAddress] = React.useState('');
    const [taskDescription, setTaskDescription] = React.useState('');
    const [priority, setPriority] = React.useState<Priority>('medium');
    const [dueDate, setDueDate] = React.useState<Date | null>(new Date());

    const [bsLatitude, setBsLatitude] = React.useState<string>('');
    const [bsLongitude, setBsLongitude] = React.useState<string>('');

    const [members, setMembers] = React.useState<MemberOption[]>([]);
    const [membersLoading, setMembersLoading] = React.useState(false);
    const [membersError, setMembersError] = React.useState<string | null>(null);
    const [selectedExecutor, setSelectedExecutor] = React.useState<MemberOption | null>(null);

    const [existingAttachments, setExistingAttachments] = React.useState<
        Array<{ key: string; name: string; url?: string; size?: number }>
    >([]);
    const [attachments, setAttachments] = React.useState<File[]>([]);
    const [dragActive, setDragActive] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState<number>(0);

    // Подстановка initialTask при открытии в режиме редактирования
    React.useEffect(() => {
        if (!open) return;
        if (!isEdit || !initialTask) return;

        setTaskName(initialTask.taskName ?? '');
        setBsNumber(initialTask.bsNumber ?? '');
        setBsAddress(initialTask.bsAddress ?? '');
        setTaskDescription(initialTask.taskDescription ?? '');

        const pr = (initialTask.priority || 'medium').toString().toLowerCase() as Priority;
        setPriority(['urgent', 'high', 'medium', 'low'].includes(pr) ? pr : 'medium');

        setDueDate(initialTask.dueDate ? new Date(initialTask.dueDate) : null);

        setBsLatitude(typeof initialTask.bsLatitude === 'number' ? String(initialTask.bsLatitude) : '');
        setBsLongitude(typeof initialTask.bsLongitude === 'number' ? String(initialTask.bsLongitude) : '');

        if (initialTask.executorEmail || initialTask.executorName || initialTask.executorId) {
            setSelectedExecutor({
                id: initialTask.executorId || 'unknown',
                name: initialTask.executorName || initialTask.executorEmail || 'Executor',
                email: initialTask.executorEmail || '',
            });
        } else {
            setSelectedExecutor(null);
        }

        // показать уже существующие вложения, если сервер их прислал
        const files = initialTask.files ?? [];
        setExistingAttachments(
            files
                .filter(Boolean)
                .map((f, i) => ({
                    key: `${f?.name ?? 'file'}:${f?.size ?? i}`,
                    name: f?.name ?? `file-${i + 1}`,
                    url: f?.url,
                    size: f?.size,
                }))
        );

        setAttachments([]);
        setUploadProgress(0);
        setUploading(false);
    }, [open, isEdit, initialTask]);

    // Загрузка активных участников при открытии диалога
    React.useEffect(() => {
        if (!open || !orgSlug) return;
        let aborted = false;

        async function loadMembers(): Promise<void> {
            setMembersLoading(true);
            setMembersError(null);
            try {
                const res = await fetch(apiPath(`/members?status=active`), {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                    cache: 'no-store',
                });

                let body: unknown = null;
                try {
                    body = await res.json();
                } catch {
                    /* ignore */
                }

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
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : 'Failed to load members';
                if (!aborted) setMembersError(msg);
            } finally {
                if (!aborted) setMembersLoading(false);
            }
        }

        void loadMembers();
        return () => {
            aborted = true;
        };
    }, [open, orgSlug, apiPath]);

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
        setExistingAttachments([]);
        setAttachments([]);
        setUploadProgress(0);
        setUploading(false);
    };

    const handleClose = () => {
        if (saving || uploading) return;
        if (!isEdit) reset();
        onCloseAction();
    };

    // Drag & Drop
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
        e.currentTarget.value = '';
    };

    const addFiles = (files: File[]) => {
        const existing = new Set(attachments.map((f) => `${f.name}:${f.size}`));
        const toAdd = files.filter((f) => !existing.has(`${f.name}:${f.size}`));
        setAttachments((prev) => [...prev, ...toAdd]);
    };

    const removeFile = (name: string, size: number) => {
        setAttachments((prev) => prev.filter((f) => !(f.name === name && f.size === size)));
    };

    // Upload attachments (используем короткий taskId)
    async function uploadAttachments(taskShortId: string): Promise<void> {
        if (!attachments.length) return;
        setUploading(true);
        setUploadProgress(0);

        for (let i = 0; i < attachments.length; i++) {
            const file = attachments[i];
            const fd = new FormData();
            fd.append('file', file, file.name);
            fd.append('taskId', taskShortId); // короткий id задачи
            fd.append('subfolder', 'attachments');
            fd.append('orgSlug', orgSlug || '');

            const res = await fetch('/api/upload', { method: 'POST', body: fd });

            if (!res.ok) {
                let body: unknown = null;
                try {
                    body = await res.json();
                } catch {
                    /* ignore */
                }
                const errText = extractErrorMessage(body, res.statusText);
                console.error('File upload failed:', errText);
            }
            setUploadProgress(Math.round(((i + 1) / attachments.length) * 100));
        }

        setUploading(false);
    }

    async function handleCreate() {
        if (!taskName || !bsNumber) return;
        if (!isLatValid || !isLngValid) return;
        if (!orgSlug || !projectRef) return;

        setSaving(true);
        const newTaskId = genId();

        try {
            const payload = {
                taskId: newTaskId,
                taskName,
                bsNumber,
                bsAddress,
                taskDescription: taskDescription?.trim() || undefined,
                status: 'To do',
                priority,
                dueDate: dueDate ? dueDate.toISOString() : undefined,
                bsLatitude: bsLatitude === '' ? undefined : Number(bsLatitude),
                bsLongitude: bsLongitude === '' ? undefined : Number(bsLongitude),
                executorId: selectedExecutor?.id,
                executorName: selectedExecutor?.name,
                executorEmail: selectedExecutor?.email,
            };

            const res = await fetch(
                apiPath(`/projects/${encodeURIComponent(projectRef)}/tasks`),
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
            );

            if (!res.ok) {
                let body: unknown = null;
                try {
                    body = await res.json();
                } catch {
                    /* ignore */
                }
                console.error('Failed to create task:', extractErrorMessage(body, res.statusText));
                return;
            }

            await uploadAttachments(newTaskId);
            reset();
            onCreatedAction();
        } catch (e: unknown) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    }

    async function handleUpdate() {
        if (!initialTask) return;
        if (!taskName || !bsNumber) return;
        if (!isLatValid || !isLngValid) return;
        if (!orgSlug || !projectRef) return;

        setSaving(true);
        try {
            const payload = {
                taskName,
                bsNumber,
                bsAddress,
                taskDescription: taskDescription?.trim() || undefined,
                priority,
                dueDate: dueDate ? dueDate.toISOString() : undefined,
                bsLatitude: bsLatitude === '' ? undefined : Number(bsLatitude),
                bsLongitude: bsLongitude === '' ? undefined : Number(bsLongitude),
                executorId: selectedExecutor?.id,
                executorName: selectedExecutor?.name,
                executorEmail: selectedExecutor?.email,
            };

            const res = await fetch(
                apiPath(`/projects/${encodeURIComponent(projectRef)}/tasks/${encodeURIComponent(initialTask._id)}`),
                { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }
            );

            if (!res.ok) {
                let body: unknown = null;
                try {
                    body = await res.json();
                } catch {
                    /* ignore */
                }
                console.error('Failed to update task:', extractErrorMessage(body, res.statusText));
                return;
            }

            // если в редактировании добавили новые файлы — зальём их taskId
            if (attachments.length) {
                await uploadAttachments(initialTask.taskId);
            }

            onCreatedAction();
        } catch (e: unknown) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    }

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
                <DialogTitle>{isEdit ? 'Редактировать задачу' : 'Создать задачу'}</DialogTitle>
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

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <TextField
                                label="Latitude (Широта)"
                                type="number"
                                value={bsLatitude}
                                onChange={(e) => setBsLatitude(e.target.value)}
                                error={!isLatValid}
                                placeholder="напр. 52.270889"
                                helperText={!isLatValid ? 'Широта должна быть в диапазоне −90…90' : 'WGS-84, десятичные градусы'}
                                fullWidth
                                slotProps={{ input: { inputProps: { step: 'any', min: -90, max: 90 } } }}
                            />
                            <TextField
                                label="Longitude (Долгота)"
                                type="number"
                                value={bsLongitude}
                                onChange={(e) => setBsLongitude(e.target.value)}
                                error={!isLngValid}
                                placeholder="напр. 104.599610"
                                helperText={!isLngValid ? 'Долгота должна быть в диапазоне −180…180' : 'WGS-84, десятичные градусы'}
                                fullWidth
                                slotProps={{ input: { inputProps: { step: 'any', min: -180, max: 180 } } }}
                            />
                        </Stack>

                        <TextField
                            label="Описание задачи"
                            value={taskDescription}
                            onChange={(e) => setTaskDescription(e.target.value)}
                            multiline
                            minRows={3}
                            maxRows={10}
                            placeholder="Что сделать, детали, ссылки и пр."
                            fullWidth
                        />

                        <Autocomplete<MemberOption>
                            options={members}
                            value={selectedExecutor}
                            onChange={(_e, val) => setSelectedExecutor(val)}
                            getOptionLabel={(opt) => opt?.name || opt?.email || ''}
                            loading={membersLoading}
                            noOptionsText={membersError ? `Ошибка: ${membersError}` : 'Нет активных участников'}
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
                                    <Avatar src={option.profilePic} alt={option.name} sx={{ width: 24, height: 24, mr: 1 }}>
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
                                <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                                    <MenuItem value="urgent">Urgent</MenuItem>
                                    <MenuItem value="high">High</MenuItem>
                                    <MenuItem value="medium">Medium</MenuItem>
                                    <MenuItem value="low">Low</MenuItem>
                                </Select>
                            </FormControl>

                            <DatePicker label="Due Date" value={dueDate} onChange={(d) => setDueDate(d)} slotProps={{ textField: { fullWidth: true } }} />
                        </Stack>

                        {/* Зона добавления файлов */}
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
                            <Typography variant="body1">Перетащите файлы сюда или нажмите для выбора</Typography>
                            <Typography variant="caption" color="text.secondary">
                                Вложения будут сохранены как <b>attachments</b> этой задачи
                            </Typography>
                            <input ref={inputRef} type="file" multiple hidden onChange={onFileInputChange} />
                        </Box>

                        {/* Уже существующие вложения */}
                        {!!existingAttachments.length && (
                            <Box>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                    Уже прикреплено: {existingAttachments.length}
                                </Typography>
                                <Stack direction="row" flexWrap="wrap" gap={1}>
                                    {existingAttachments.map((f) => (
                                        <Chip
                                            key={f.key}
                                            label={`${f.name}${typeof f.size === 'number' ? ` (${Math.round(f.size / 1024)} KB)` : ''}`}
                                            component={f.url ? 'a' : 'div'}
                                            href={f.url}
                                            clickable={Boolean(f.url)}
                                            target={f.url ? '_blank' : undefined}
                                            rel={f.url ? 'noopener noreferrer' : undefined}
                                            sx={{ maxWidth: '100%' }}
                                        />
                                    ))}
                                </Stack>
                            </Box>
                        )}

                        {/* Новые вложения, которые пользователь добавил сейчас */}
                        {!!attachments.length && (
                            <Box>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                                    <Typography variant="subtitle2">Вложения к загрузке: {attachments.length}</Typography>
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
                    {isEdit ? (
                        <Button
                            onClick={handleUpdate}
                            variant="contained"
                            disabled={saving || !taskName || !bsNumber || !isLatValid || !isLngValid}
                        >
                            Сохранить
                        </Button>
                    ) : (
                        <Button
                            onClick={handleCreate}
                            variant="contained"
                            disabled={saving || uploading || !taskName || !bsNumber || !isLatValid || !isLngValid}
                        >
                            Создать
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
}

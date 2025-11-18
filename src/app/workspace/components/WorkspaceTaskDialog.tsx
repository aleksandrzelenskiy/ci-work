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
    Snackbar,
    Alert,
    Drawer,
    Divider,
} from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import CloseIcon from '@mui/icons-material/Close';
import { YMaps, Map, Placemark } from '@pbe/react-yandex-maps';

type Priority = 'urgent' | 'high' | 'medium' | 'low';

type MemberOption = {
    id: string;
    name: string;
    email: string;
    profilePic?: string;
    clerkId?: string;
};

type MembersApi = {
    members: Array<{ _id: string; userName?: string; userEmail: string; profilePic?: string; clerkId?: string }>;
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
    files?: Array<{ name?: string; url?: string; size?: number }>;
    attachments?: string[];
    bsLocation?: Array<{ name: string; coordinates: string }>;
};

type Props = {
    open: boolean;
    org: string;
    project: string;
    onCloseAction: () => void;
    onCreatedAction: () => void;
    mode?: 'create' | 'edit';
    initialTask?: TaskForEdit | null;
};

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

type BsOption = {
    id: string;
    name: string;
    address?: string;
    lat?: number | null;
    lon?: number | null;
};

function getDisplayBsName(raw: string): string {
    const trimmed = raw.trim();
    if (/^IR\d+/i.test(trimmed)) {
        const firstPart = trimmed.split(',')[0]?.trim();
        return firstPart || trimmed;
    }
    return trimmed;
}

function normalizeAddressFromDb(bsNumber: string, raw?: string): string {
    let addr = (raw ?? '').trim();
    if (addr.startsWith('-')) {
        addr = addr.slice(1).trim();
    }
    const hasIrPrefix = /^IR\d+/i.test(bsNumber.trim());
    if (hasIrPrefix) {
        if (!addr.startsWith('Иркутская область')) {
            addr = `Иркутская область, ${addr}`;
        }
    }
    return addr;
}

const defaultFilter = createFilterOptions<BsOption>();

function getFileNameFromUrl(url?: string): string {
    if (!url) return 'file';
    try {
        const parts = url.split('/');
        return parts[parts.length - 1] || url;
    } catch {
        return url;
    }
}

const glassInputSx = {
    '& .MuiOutlinedInput-root': {
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 3,
        '& fieldset': { borderColor: 'rgba(255,255,255,0.6)' },
        '&:hover fieldset': { borderColor: 'rgba(147,197,253,0.9)' },
        '&.Mui-focused fieldset': { borderColor: 'rgba(59,130,246,0.8)' },
    },
};

const YMAPS_API_KEY = process.env.NEXT_PUBLIC_YMAPS_API_KEY || '1c3860d8-3994-4e6e-841b-31ad57f69c78';

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
    const [bsInput, setBsInput] = React.useState('');
    const [bsAddress, setBsAddress] = React.useState('');
    const [taskDescription, setTaskDescription] = React.useState('');
    const [priority, setPriority] = React.useState<Priority>('medium');
    const [dueDate, setDueDate] = React.useState<Date | null>(new Date());

    const [bsLatitude, setBsLatitude] = React.useState<string>('');
    const [bsLongitude, setBsLongitude] = React.useState<string>('');

    // новое поле: стоимость
    const [totalCost, setTotalCost] = React.useState<string>('');

    const [projectMeta, setProjectMeta] = React.useState<{ regionCode?: string; operator?: string } | null>(null);

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

    const [bsOptions, setBsOptions] = React.useState<BsOption[]>([]);
    const [bsOptionsLoading, setBsOptionsLoading] = React.useState(false);
    const [bsOptionsError, setBsOptionsError] = React.useState<string | null>(null);
    const [selectedBsOption, setSelectedBsOption] = React.useState<BsOption | null>(null);

    // диалог удаления существующего файла
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [attachmentToDelete, setAttachmentToDelete] = React.useState<{
        key: string;
        name: string;
        url?: string;
    } | null>(null);
    const [deletingExisting, setDeletingExisting] = React.useState(false);

    const [snackbarOpen, setSnackbarOpen] = React.useState(false);
    const [snackbarMsg, setSnackbarMsg] = React.useState('');
    const [snackbarSeverity, setSnackbarSeverity] = React.useState<'success' | 'error'>('success');

    const loadProjectMeta = React.useCallback(async () => {
        if (!projectRef) return;
        try {
            const res = await fetch(
                apiPath(`/projects/${encodeURIComponent(projectRef)}`),
                { method: 'GET', cache: 'no-store' }
            );
            const body = await res.json();
            if (!res.ok || !body?.ok) {
                setProjectMeta(null);
                console.error('Failed to load project info:', extractErrorMessage(body, res.statusText));
                return;
            }
            setProjectMeta({
                regionCode: body.project?.regionCode,
                operator: body.project?.operator,
            });
        } catch (e: unknown) {
            setProjectMeta(null);
            console.error(e);
        }
    }, [apiPath, projectRef]);

    React.useEffect(() => {
        if (!projectRef) return;
        void loadProjectMeta();
    }, [projectRef, loadProjectMeta]);

    const loadBsOptions = React.useCallback(async (term: string) => {
        setBsOptionsLoading(true);
        setBsOptionsError(null);
        try {
            const qs = new URLSearchParams();
            if (term) qs.set('q', term);
            if (projectMeta?.regionCode) qs.set('region', projectMeta.regionCode);
            if (projectMeta?.operator) qs.set('operator', projectMeta.operator);
            const query = qs.toString();
            const url = `/api/objects${query ? `?${query}` : ''}`;
            const res = await fetch(url, { method: 'GET', cache: 'no-store' });
            const body = await res.json();
            if (!res.ok) {
                setBsOptionsError(extractErrorMessage(body, res.statusText));
                setBsOptions([]);
                return;
            }
            const arr = (body?.objects ?? []) as BsOption[];
            setBsOptions(arr);
        } catch (e: unknown) {
            setBsOptionsError(e instanceof Error ? e.message : 'Failed to load objects');
            setBsOptions([]);
        } finally {
            setBsOptionsLoading(false);
        }
    }, [projectMeta?.regionCode, projectMeta?.operator]);

    React.useEffect(() => {
        if (!open) return;
        if (!isEdit || !initialTask) return;

        setTaskName(initialTask.taskName ?? '');
        const initialBs = initialTask.bsNumber ? getDisplayBsName(initialTask.bsNumber) : '';
        setBsNumber(initialBs);
        setBsInput(initialBs);
        setBsAddress(initialTask.bsAddress ?? '');
        setTaskDescription(initialTask.taskDescription ?? '');

        const pr = (initialTask.priority || 'medium').toString().toLowerCase() as Priority;
        setPriority(['urgent', 'high', 'medium', 'low'].includes(pr) ? pr : 'medium');

        setDueDate(initialTask.dueDate ? new Date(initialTask.dueDate) : null);

        let latStr =
            typeof initialTask.bsLatitude === 'number'
                ? String(initialTask.bsLatitude).replace(',', '.')
                : '';
        let lonStr =
            typeof initialTask.bsLongitude === 'number'
                ? String(initialTask.bsLongitude).replace(',', '.')
                : '';

        if ((!latStr || !lonStr) && Array.isArray(initialTask.bsLocation) && initialTask.bsLocation.length > 0) {
            const coord = initialTask.bsLocation[0]?.coordinates || '';
            const parts = coord.split(/\s+/).filter(Boolean);
            if (parts.length >= 2) {
                latStr = latStr || parts[0];
                lonStr = lonStr || parts[1];
            }
        }

        setBsLatitude(latStr);
        setBsLongitude(lonStr);

        // подставляем стоимость из задачи
        setTotalCost(
            typeof initialTask.totalCost === 'number' && !Number.isNaN(initialTask.totalCost)
                ? String(initialTask.totalCost)
                : ''
        );

        if (initialTask.executorEmail || initialTask.executorName || initialTask.executorId) {
            setSelectedExecutor({
                id: initialTask.executorId || 'unknown',
                name: initialTask.executorName || initialTask.executorEmail || 'Executor',
                email: initialTask.executorEmail || '',
            });
        } else {
            setSelectedExecutor(null);
        }

        const filesFromTask = initialTask.files ?? [];
        const attachmentsFromTask = Array.isArray(initialTask.attachments) ? initialTask.attachments : [];

        const merged = [
            ...filesFromTask
                .filter(Boolean)
                .map((f, i) => ({
                    key: `${f?.name ?? 'file'}:${f?.size ?? i}`,
                    name: f?.name ?? `file-${i + 1}`,
                    url: f?.url,
                    size: f?.size,
                })),
            ...attachmentsFromTask.map((url, i) => ({
                key: `att-${i}`,
                name: getFileNameFromUrl(url),
                url,
            })),
        ];

        setExistingAttachments(merged);

        setAttachments([]);
        setUploadProgress(0);
        setUploading(false);

        if (initialTask.bsNumber) {
            void loadBsOptions(initialTask.bsNumber);
        }

        setSelectedBsOption(null);
    }, [open, isEdit, initialTask, loadBsOptions]);

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
                    id: m.clerkId ? m.clerkId : String(m._id),
                    clerkId: m.clerkId ?? undefined,
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

    const mapCoords = React.useMemo<[number, number] | null>(() => {
        const latRaw = bsLatitude.trim();
        const lonRaw = bsLongitude.trim();
        if (!latRaw || !lonRaw) return null;
        if (!isLatValid || !isLngValid) return null;
        const lat = Number(latRaw);
        const lon = Number(lonRaw);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return [lat, lon];
    }, [bsLatitude, bsLongitude, isLatValid, isLngValid]);

    const reset = () => {
        setTaskName('');
        setBsNumber('');
        setBsInput('');
        setBsAddress('');
        setTaskDescription('');
        setPriority('medium');
        setDueDate(new Date());
        setBsLatitude('');
        setBsLongitude('');
        setSelectedExecutor(null);
        setSelectedBsOption(null);
        setExistingAttachments([]);
        setAttachments([]);
        setUploadProgress(0);
        setUploading(false);
        setTotalCost('');
    };

    const handleSnackbarClose = () => setSnackbarOpen(false);

    const handleClose = () => {
        if (saving || uploading) return;
        if (!isEdit) reset();
        onCloseAction();
    };

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

    async function uploadAttachments(taskShortId: string): Promise<void> {
        if (!attachments.length) return;
        setUploading(true);
        setUploadProgress(0);

        for (let i = 0; i < attachments.length; i++) {
            const file = attachments[i];
            const fd = new FormData();
            fd.append('file', file, file.name);
            fd.append('taskId', taskShortId);
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

    function buildBsLocation(): Array<{ name: string; coordinates: string }> {
        if (selectedBsOption) {
            const displayName = getDisplayBsName(selectedBsOption.name);
            const lat = typeof selectedBsOption.lat === 'number' ? String(selectedBsOption.lat).replace(',', '.') : '';
            const lon = typeof selectedBsOption.lon === 'number' ? String(selectedBsOption.lon).replace(',', '.') : '';
            if (lat && lon) {
                return [{ name: displayName, coordinates: `${lat} ${lon}` }];
            }
        }

        const lat = bsLatitude.trim();
        const lon = bsLongitude.trim();
        if (bsNumber.trim() && lat && lon) {
            return [{ name: bsNumber.trim(), coordinates: `${lat} ${lon}` }];
        }

        return [];
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
                bsLocation: buildBsLocation(),
                executorId: selectedExecutor ? selectedExecutor.id : null, // null, если не выбрали
                executorName: selectedExecutor ? selectedExecutor.name : null,
                executorEmail: selectedExecutor ? selectedExecutor.email : null,

                totalCost: totalCost.trim() ? Number(totalCost.trim()) : undefined,
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
                bsLocation: buildBsLocation(),
                executorId: selectedExecutor ? selectedExecutor.id : null,
                executorName: selectedExecutor ? selectedExecutor.name : null,
                executorEmail: selectedExecutor ? selectedExecutor.email : null,
                totalCost: totalCost.trim() ? Number(totalCost.trim()) : undefined,
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

    const handleSelectBsOption = (opt: BsOption | null) => {
        if (!opt) {
            setSelectedBsOption(null);
            return;
        }
        const displayName = getDisplayBsName(opt.name);
        setBsNumber(displayName);
        setBsInput(displayName);
        setSelectedBsOption(opt);
        const normalized = normalizeAddressFromDb(displayName, opt.address);
        setBsAddress(normalized);
        setBsLatitude(typeof opt.lat === 'number' ? String(opt.lat).replace(',', '.') : '');
        setBsLongitude(typeof opt.lon === 'number' ? String(opt.lon).replace(',', '.') : '');
    };

    const bsSearchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleBsInputChange = (_e: React.SyntheticEvent, value: string) => {
        setBsInput(value);
        setBsNumber(value);
        setSelectedBsOption(null);
        if (bsSearchTimeout.current) clearTimeout(bsSearchTimeout.current);
        if (!value.trim()) {
            setBsOptions([]);
            return;
        }
        bsSearchTimeout.current = setTimeout(() => {
            void loadBsOptions(value);
        }, 300);
    };

    // запрашиваем удаление существующего файла
    const requestDeleteExisting = (file: { key: string; name: string; url?: string }) => {
        setAttachmentToDelete(file);
        setDeleteDialogOpen(true);
    };

    const confirmDeleteExisting = async () => {
        if (!attachmentToDelete) return;

        if (isEdit && initialTask?.taskId && attachmentToDelete.url) {
            setDeletingExisting(true);
            try {
                const q = new URLSearchParams({
                    taskId: initialTask.taskId,
                    url: attachmentToDelete.url,
                });
                const res = await fetch(`/api/upload?${q.toString()}`, {
                    method: 'DELETE',
                });
                const body = await res.json().catch(() => ({}));

                if (!res.ok) {
                    const msg = extractErrorMessage(body, res.statusText);
                    setSnackbarMsg(`Ошибка удаления: ${msg}`);
                    setSnackbarSeverity('error');
                    setSnackbarOpen(true);
                } else {
                    setExistingAttachments((prev) => prev.filter((x) => x.key !== attachmentToDelete.key));
                    setSnackbarMsg('Вложение удалено');
                    setSnackbarSeverity('success');
                    setSnackbarOpen(true);
                }
            } catch (e) {
                console.error(e);
                setSnackbarMsg('Ошибка удаления');
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
            } finally {
                setDeletingExisting(false);
            }
        } else {
            setExistingAttachments((prev) => prev.filter((x) => x.key !== attachmentToDelete.key));
            setSnackbarMsg('Вложение удалено');
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
        }

        setDeleteDialogOpen(false);
        setAttachmentToDelete(null);
    };

    const cancelDeleteExisting = () => {
        setDeleteDialogOpen(false);
        setAttachmentToDelete(null);
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Drawer
                anchor="right"
                open={open}
                onClose={handleClose}
                ModalProps={{ keepMounted: true }}
                PaperProps={{
                    sx: {
                        width: { xs: '100%', sm: 520 },
                        maxWidth: '100%',
                        background: 'linear-gradient(180deg, rgba(250,252,255,0.9), rgba(240,244,252,0.92))',
                        borderLeft: '1px solid rgba(148,163,184,0.3)',
                        boxShadow: '-35px 0 80px rgba(15,23,42,0.35)',
                        backdropFilter: 'blur(24px)',
                        color: 'text.primary',
                    },
                }}
            >
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <Box
                        sx={{
                            px: 3,
                            py: 2.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid rgba(148,163,184,0.25)',
                            background: 'linear-gradient(120deg, rgba(255,255,255,0.95), rgba(240,248,255,0.9))',
                        }}
                    >
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Box
                                sx={{
                                    width: 50,
                                    height: 50,
                                    borderRadius: 16,
                                    background: 'linear-gradient(135deg, rgba(59,130,246,0.95), rgba(14,165,233,0.85))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#fff',
                                    boxShadow: '0 18px 35px rgba(59,130,246,0.35)',
                                }}
                            >
                                <TaskAltIcon />
                            </Box>
                            <Box>
                                <Typography variant="h6" fontWeight={700}>
                                    {isEdit ? 'Редактировать задачу' : 'Создать задачу'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Всё, как в меню создания проекта, только для задач
                                </Typography>
                            </Box>
                        </Stack>
                        <IconButton onClick={handleClose} sx={{ color: 'text.secondary' }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
                        <Stack spacing={2.5}>
                            <TextField
                                label="Task Name"
                                value={taskName}
                                onChange={(e) => setTaskName(e.target.value)}
                                required
                                fullWidth
                                sx={glassInputSx}
                            />

                            <Autocomplete<BsOption, false, false, true>
                                freeSolo
                                options={bsOptions}
                                loading={bsOptionsLoading}
                                value={bsNumber}
                                inputValue={bsInput}
                                onChange={(_e, val) => {
                                    if (typeof val === 'string') {
                                        setBsNumber(val);
                                        setBsInput(val);
                                        setSelectedBsOption(null);
                                        return;
                                    }
                                    if (val) {
                                        handleSelectBsOption(val);
                                    } else {
                                        setBsNumber('');
                                        setBsInput('');
                                        setSelectedBsOption(null);
                                    }
                                }}
                                onInputChange={handleBsInputChange}
                                getOptionLabel={(opt) =>
                                    typeof opt === 'string' ? opt : getDisplayBsName(opt.name)
                                }
                                filterOptions={(opts, params) => {
                                    if (!params.inputValue.trim()) {
                                        return [];
                                    }
                                    return defaultFilter(opts, params);
                                }}
                                isOptionEqualToValue={(option, value) => option.id === (value as BsOption).id}
                                noOptionsText={bsOptionsError ? `Ошибка: ${bsOptionsError}` : 'Не найдено'}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="BS Number"
                                        required
                                        fullWidth
                                        sx={glassInputSx}
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {bsOptionsLoading ? (
                                                        <CircularProgress size={18} sx={{ mr: 1 }} />
                                                    ) : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
                                    />
                                )}
                                renderOption={(props, option) => (
                                    <li {...props} key={option.id}>
                                        <Box>
                                            <Typography variant="body2">{getDisplayBsName(option.name)}</Typography>
                                            {option.address ? (
                                                <Typography variant="caption" color="text.secondary">
                                                    {option.address}
                                                </Typography>
                                            ) : null}
                                        </Box>
                                    </li>
                                )}
                            />

                            <TextField
                                label="BS Address"
                                value={bsAddress}
                                onChange={(e) => setBsAddress(e.target.value)}
                                fullWidth
                                sx={glassInputSx}
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    label="Latitude (Широта)"
                                    type="text"
                                    value={bsLatitude}
                                    onChange={(e) => {
                                        const v = e.target.value.replace(',', '.');
                                        setBsLatitude(v);
                                    }}
                                    error={!isLatValid}
                                    placeholder="52.219319"
                                    helperText={
                                        !isLatValid ? 'Широта должна быть в диапазоне −90…90' : 'WGS-84, десятичные градусы'
                                    }
                                    fullWidth
                                    inputProps={{ inputMode: 'decimal' }}
                                    sx={glassInputSx}
                                />
                            <TextField
                                label="Longitude (Долгота)"
                                type="text"
                                value={bsLongitude}
                                onChange={(e) => {
                                    const v = e.target.value.replace(',', '.');
                                    setBsLongitude(v);
                                }}
                                error={!isLngValid}
                                placeholder="104.26913"
                                helperText={
                                    !isLngValid
                                        ? 'Долгота должна быть в диапазоне −180…180'
                                        : 'WGS-84, десятичные градусы'
                                }
                                fullWidth
                                inputProps={{ inputMode: 'decimal' }}
                                sx={glassInputSx}
                            />
                        </Stack>

                        {mapCoords && (
                            <Box>
                                <Alert severity="warning" sx={{ mb: 1 }}>
                                    Проверьте корректность координат объекта пред созданием задачи!
                                </Alert>
                                <Box
                                    sx={{
                                        borderRadius: 3,
                                        overflow: 'hidden',
                                        height: 260,
                                        boxShadow: '0 30px 65px rgba(15,23,42,0.18)',
                                        border: '1px solid rgba(148,163,184,0.35)',
                                    }}
                                >
                                    <YMaps query={{ apikey: YMAPS_API_KEY, lang: 'ru_RU' }}>
                                        <Map
                                            state={{ center: mapCoords, zoom: 14, type: 'yandex#hybrid' }}
                                            width="100%"
                                            height="100%"
                                        >
                                            <Placemark
                                                geometry={mapCoords}
                                                options={{ preset: 'islands#redIcon', iconColor: '#ef4444' }}
                                            />
                                        </Map>
                                    </YMaps>
                                </Box>
                            </Box>
                        )}

                        <TextField
                            label="Описание задачи"
                            value={taskDescription}
                            onChange={(e) => setTaskDescription(e.target.value)}
                            multiline
                            minRows={3}
                            maxRows={10}
                            placeholder="Что сделать, детали, ссылки и пр."
                            fullWidth
                            sx={glassInputSx}
                        />

                        <TextField
                            label="Стоимость, ₽"
                            type="number"
                            value={totalCost}
                            onChange={(e) => setTotalCost(e.target.value)}
                            fullWidth
                            inputProps={{ min: 0, step: '0.01' }}
                            sx={glassInputSx}
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
                                    sx={glassInputSx}
                                    InputProps={{
                                        ...params.InputProps,
                                        endAdornment: (
                                            <>
                                                {membersLoading ? (
                                                    <CircularProgress size={18} sx={{ mr: 1 }} />
                                                ) : null}
                                                {params.InputProps.endAdornment}
                                            </>
                                        ),
                                    }}
                                />
                            )}
                            renderOption={(props, option) => {
                                const { key, ...optionProps } = props;
                                return (
                                    <li {...optionProps} key={key}>
                                        <Avatar src={option.profilePic} alt={option.name} sx={{ width: 24, height: 24, mr: 1 }}>
                                            {(option.name || option.email)?.[0]?.toUpperCase() ?? 'U'}
                                        </Avatar>
                                        <ListItemText primary={option.name} secondary={option.email} />
                                    </li>
                                );
                            }}
                            isOptionEqualToValue={(opt, val) => opt.id === val.id}
                        />

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <FormControl fullWidth sx={glassInputSx}>
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
                                format="dd.MM.yyyy"
                                slotProps={{ textField: { fullWidth: true, sx: glassInputSx } }}
                            />
                        </Stack>

                        {!!existingAttachments.length && (
                            <Box>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                    Уже прикреплено: {existingAttachments.length}
                                </Typography>
                                <Stack direction="row" flexWrap="wrap" gap={1}>
                                    {existingAttachments.map((f) => (
                                        <Box key={f.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Chip
                                                label={f.name}
                                                component={f.url ? 'a' : 'div'}
                                                href={f.url}
                                                clickable={Boolean(f.url)}
                                                target={f.url ? '_blank' : undefined}
                                                rel={f.url ? 'noopener noreferrer' : undefined}
                                                sx={{ maxWidth: '100%' }}
                                            />
                                            <Tooltip title="Удалить">
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        requestDeleteExisting(f);
                                                    }}
                                                >
                                                    <DeleteOutlineIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    ))}
                                </Stack>
                            </Box>
                        )}

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

                        <Box
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                            sx={{
                                border: '1.5px dashed',
                                borderColor: dragActive ? 'rgba(59,130,246,0.8)' : 'rgba(148,163,184,0.5)',
                                borderRadius: 3,
                                p: 3,
                                textAlign: 'center',
                                cursor: 'pointer',
                                backgroundColor: dragActive ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.7)',
                                transition: 'all 180ms ease',
                                boxShadow: dragActive ? '0 20px 45px rgba(15,23,42,0.15)' : 'none',
                            }}
                            onClick={openFileDialog}
                        >
                            <CloudUploadIcon sx={{ fontSize: 36, mb: 1, color: 'primary.main' }} />
                            <Typography variant="body1">Перетащите файлы или нажмите, чтобы выбрать</Typography>
                            <Typography variant="caption" color="text.secondary">
                                Вложения будут сохранены как <b>attachments</b> этой задачи
                            </Typography>
                            <input ref={inputRef} type="file" multiple hidden onChange={onFileInputChange} />
                        </Box>
                    </Stack>
                </Box>

                <Divider sx={{ borderColor: 'rgba(148,163,184,0.25)' }} />

                <Box sx={{ px: 3, py: 2.5, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
                    <Button
                        onClick={handleClose}
                        disabled={saving || uploading}
                        sx={{ borderRadius: 999, px: 3 }}
                    >
                        Отмена
                    </Button>
                    {isEdit ? (
                        <Button
                            onClick={handleUpdate}
                            variant="contained"
                            disabled={saving || !taskName || !bsNumber || !isLatValid || !isLngValid}
                            sx={{
                                borderRadius: 999,
                                px: 3,
                                textTransform: 'none',
                                boxShadow: '0 20px 45px rgba(59,130,246,0.45)',
                            }}
                        >
                            Сохранить
                        </Button>
                    ) : (
                        <Button
                            onClick={handleCreate}
                            variant="contained"
                            disabled={saving || uploading || !taskName || !bsNumber || !isLatValid || !isLngValid}
                            sx={{
                                borderRadius: 999,
                                px: 3,
                                textTransform: 'none',
                                boxShadow: '0 20px 45px rgba(59,130,246,0.45)',
                            }}
                        >
                            Создать
                        </Button>
                    )}
                </Box>
            </Box>
        </Drawer>

            {/* диалог подтверждения удаления существующего файла */}
            <Dialog open={deleteDialogOpen} onClose={cancelDeleteExisting}>
                <DialogTitle>Удалить вложение?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2">
                        {attachmentToDelete?.name ? `Удалить "${attachmentToDelete.name}"?` : 'Удалить вложение?'} Файл будет
                        удалён и с сервера.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={cancelDeleteExisting} disabled={deletingExisting}>
                        Отмена
                    </Button>
                    <Button
                        onClick={confirmDeleteExisting}
                        color="error"
                        variant="contained"
                        disabled={deletingExisting}
                    >
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbarOpen}
                autoHideDuration={3000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} variant="filled" sx={{ width: '100%' }}>
                    {snackbarMsg}
                </Alert>
            </Snackbar>
        </LocalizationProvider>
    );
}

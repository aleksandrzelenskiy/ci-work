// src/app/workspace/components/ProjectTaskList.tsx
'use client';

import React, { useMemo, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useRouter } from 'next/navigation';
import {
    Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
    IconButton, Tooltip, Chip, Popover, FormControl, InputLabel, Select, MenuItem,
    Checkbox, List, ListItem, ListItemIcon, ListItemText, Pagination, Alert, Avatar, Stack, Button, TextField,
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Menu, MenuItem as MMenuItem, Divider,
    ListItemIcon as MListItemIcon, ListItemText as MListItemText,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import FilterListIcon from '@mui/icons-material/FilterList';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { useTheme } from '@mui/material/styles';
import { getStatusColor } from '@/utils/statusColors';
import { getPriorityIcon, getPriorityLabelRu, normalizePriority, type Priority as Pri } from '@/utils/priorityIcons';

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import WorkspaceTaskDialog, { TaskForEdit } from '@/app/workspace/components/WorkspaceTaskDialog';

/* ───────────── типы ───────────── */
type StatusTitle =
    | 'To do'
    | 'Assigned'
    | 'At work'
    | 'Done'
    | 'Pending'
    | 'Issues'
    | 'Fixed'
    | 'Agreed';

const STATUS_ORDER: StatusTitle[] = [
    'To do',
    'Assigned',
    'At work',
    'Done',
    'Pending',
    'Issues',
    'Fixed',
    'Agreed',
];

const STATUS_LABELS_RU: Record<StatusTitle, string> = {
    'To do': 'К выполнению',
    Assigned: 'Назначена',
    'At work': 'В работе',
    Done: 'Выполнено',
    Pending: 'На проверке',
    Issues: 'Есть замечания',
    Fixed: 'Исправлено',
    Agreed: 'Согласовано',
};

type Priority = 'urgent' | 'high' | 'medium' | 'low';

type Task = {
    _id: string;
    taskId: string;
    taskName: string;
    status?: string;
    dueDate?: string;
    createdAt?: string;
    bsNumber?: string;
    totalCost?: number;
    priority?: Priority | string;
    executorId?: string;
    executorName?: string;
    executorEmail?: string;
    bsAddress?: string;
    taskDescription?: string;
    bsLatitude?: number;
    bsLongitude?: number;
    files?: Array<{ name?: string; url?: string; size?: number }>;
    attachments?: string[];
    bsLocation?: Array<{ name: string; coordinates: string }>;
};

type TaskWithStatus = Task & { _statusTitle: StatusTitle };

/* ───────────── утилиты ───────────── */
const formatDate = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ru-RU');
};

const TITLE_CASE_MAP: Record<string, StatusTitle> = {
    'TO DO': 'To do',
    'TODO': 'To do',
    'TO-DO': 'To do',
    ASSIGNED: 'Assigned',
    'IN PROGRESS': 'At work',
    'IN-PROGRESS': 'At work',
    'AT WORK': 'At work',
    DONE: 'Done',
    PENDING: 'Pending',
    ISSUES: 'Issues',
    FIXED: 'Fixed',
    AGREED: 'Agreed',
};

function normalizeStatusTitle(s?: string): StatusTitle {
    if (!s) return 'To do';
    const key = s.trim().toUpperCase();
    return TITLE_CASE_MAP[key] ?? (s as StatusTitle);
}

const normPriority = (p?: string): Priority | '' => (p ? (p.toString().toLowerCase() as Priority) : '');

const getInitials = (s?: string) =>
    (s ?? '')
        .split('@')[0]
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join('') || '•';

export interface ProjectTaskListHandle {
    toggleFilters: () => void;
    openColumns: (anchor: HTMLElement) => void;
    closeColumns: () => void;
    showFilters: boolean;
}

type ProjectTaskListProps = {
    items: Task[];
    loading: boolean;
    error: string | null;
    org: string;
    project: string;
    onReloadAction?: () => void;
    onFilterToggleChange?: (visible: boolean) => void;
};

/* ───────────── компонент ───────────── */
const ProjectTaskList = forwardRef<ProjectTaskListHandle, ProjectTaskListProps>(
    ({ items, loading, error, org, project, onReloadAction, onFilterToggleChange }, ref) => {

    const router = useRouter();
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const menuBg = isDarkMode ? 'rgba(16,21,32,0.92)' : 'rgba(255,255,255,0.92)';
    const menuBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const menuShadow = isDarkMode ? '0 30px 60px rgba(0,0,0,0.65)' : '0 30px 60px rgba(15,23,42,0.18)';
    const menuText = isDarkMode ? '#f8fafc' : '#0f172a';
    const menuIconBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
    const menuIconDangerBg = 'rgba(239,68,68,0.12)';
    const menuIconColor = menuText;
    const menuIconDangerColor = '#ef4444';
    const menuItemHover = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.05)';

    const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
        taskId: true,
        task: true,
        status: true,
        priority: true,
        executor: true,
        due: true,
    });
    const toggleColumn = (key: string) => setColumnVisibility((v) => ({ ...v, [key]: !v[key] }));

    const [showFilters, setShowFilters] = useState(false);

    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [columnsAnchor, setColumnsAnchor] = useState<HTMLElement | null>(null);
    const [currentFilter, setCurrentFilter] =
        useState<'' | 'status' | 'priority' | 'executor' | 'due'>('');
    const openFilterPopover = Boolean(anchorEl);
    const openColumnsPopover = Boolean(columnsAnchor);

    const handleFilterIconClick = (
        e: React.MouseEvent<HTMLElement>,
        type: 'status' | 'priority' | 'executor' | 'due'
    ) => {
        if (!showFilters) return;
        setAnchorEl(e.currentTarget);
        setCurrentFilter(type);
    };
    const closeFilterPopover = () => {
        setAnchorEl(null);
        setCurrentFilter('');
    };
    const closeColumnsPopover = () => setColumnsAnchor(null);

    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState<number>(10);

    const [statusFilter, setStatusFilter] = useState<'' | StatusTitle>('');
    const [priorityFilter, setPriorityFilter] = useState<'' | Priority>('');
    const [executorFilter, setExecutorFilter] = useState<string | null>(null);
    const [dueFrom, setDueFrom] = useState<Date | null>(null);
    const [dueTo, setDueTo] = useState<Date | null>(null);

    const uniqueExecutors = useMemo(() => {
        const arr = items
            .map((t) => (t.executorName?.trim() || t.executorEmail?.trim() || ''))
            .filter(Boolean);
        return Array.from(new Set(arr));
    }, [items]);

    const filtered: TaskWithStatus[] = useMemo(() => {
        let res: TaskWithStatus[] = items.map((t) => ({
            ...t,
            _statusTitle: normalizeStatusTitle(t.status),
        }));

        if (statusFilter) res = res.filter((t) => t._statusTitle === statusFilter);
        if (priorityFilter) res = res.filter((t) => normPriority(t.priority as string) === priorityFilter);
        if (executorFilter) {
            res = res.filter((t) => {
                const label = t.executorName?.trim() || t.executorEmail?.trim() || '';
                return label === executorFilter;
            });
        }
        if (dueFrom || dueTo) {
            res = res.filter((t) => {
                if (!t.dueDate) return false;
                const d = new Date(t.dueDate);
                if (Number.isNaN(d.getTime())) return false;
                const afterFrom = dueFrom ? d >= startOfDay(dueFrom) : true;
                const beforeTo = dueTo ? d <= endOfDay(dueTo) : true;
                return afterFrom && beforeTo;
            });
        }

        res.sort((a, b) => STATUS_ORDER.indexOf(a._statusTitle) - STATUS_ORDER.indexOf(b._statusTitle));
        return res;
    }, [items, statusFilter, priorityFilter, executorFilter, dueFrom, dueTo]);

    useEffect(() => {
        setPage(1);
    }, [statusFilter, priorityFilter, executorFilter, dueFrom, dueTo]);

    const totalPages = rowsPerPage === -1 ? 1 : Math.max(1, Math.ceil(filtered.length / rowsPerPage));
    const pageSlice: TaskWithStatus[] =
        rowsPerPage === -1
            ? filtered
            : filtered.slice((page - 1) * rowsPerPage, (page - 1) * rowsPerPage + rowsPerPage);

    const activeFiltersCount = useMemo(() => {
        return [
            statusFilter,
            priorityFilter,
            executorFilter ? 'executor' : '',
            dueFrom || dueTo ? 'due' : '',
        ].filter(Boolean).length;
    }, [statusFilter, priorityFilter, executorFilter, dueFrom, dueTo]);

    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
    const [selectedTask, setSelectedTask] = useState<TaskWithStatus | null>(null);

    const handleContextMenu = (e: React.MouseEvent, task: TaskWithStatus) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedTask(task);
        setMenuPos({ top: e.clientY - 4, left: e.clientX - 2 });
    };
    const handleCloseMenu = () => setMenuPos(null);

    const openTaskPage = (task: TaskWithStatus, target: '_self' | '_blank' = '_blank') => {
        const slug = task.taskId ? task.taskId : task._id;
        const href = `/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(
            project
        )}/tasks/${encodeURIComponent(slug)}`;
        if (target === '_blank' && typeof window !== 'undefined') {
            window.open(href, '_blank', 'noopener,noreferrer');
            return;
        }
        router.push(href);
    };


    const [editOpen, setEditOpen] = useState(false);
    const handleEditTask = () => {
        if (selectedTask) setEditOpen(true);
    };
    const handleEdited = () => {
        setEditOpen(false);
        onReloadAction?.();
    };

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const askDelete = () => {
        setDeleteError(null);
        setDeleteOpen(true);
    };
    const handleCancelDelete = () => setDeleteOpen(false);
    const handleConfirmDelete = async () => {
        if (!selectedTask) return;
        try {
            setDeleteLoading(true);
            setDeleteError(null);
            const url = `/api/org/${encodeURIComponent(org)}/projects/${encodeURIComponent(
                project
            )}/tasks/${encodeURIComponent(selectedTask._id)}`;
            const res = await fetch(url, { method: 'DELETE' });
            if (!res.ok) {
                const data: unknown = await res.json().catch(() => ({}));
                const msg = (data as { error?: string })?.error || `Delete failed: ${res.status}`;
                setDeleteError(msg);
                return;
            }
            setDeleteOpen(false);
            onReloadAction?.();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка удаления';
            setDeleteError(msg);
        } finally {
            setDeleteLoading(false);
        }
    };

    useImperativeHandle(
        ref,
        () => ({
            toggleFilters: () => setShowFilters((v) => !v),
            openColumns: (anchor) => setColumnsAnchor(anchor),
            closeColumns: () => setColumnsAnchor(null),
            showFilters,
        }),
        [showFilters]
    );

    useEffect(() => {
        onFilterToggleChange?.(showFilters);
    }, [showFilters, onFilterToggleChange]);

    if (loading) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">Загрузка…</Typography>
            </Box>
        );
    }
    if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;

    const popoverMinWidth = currentFilter === 'executor' ? 380 : 260;

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box>

                {showFilters && activeFiltersCount > 0 && (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', px: 1, pb: 1 }}>
                        {statusFilter && (
                            <Chip
                                size="small"
                                color="primary"
                                label={`Статус: ${STATUS_LABELS_RU[statusFilter] ?? statusFilter}`}
                                onDelete={() => setStatusFilter('')}
                            />
                        )}
                        {priorityFilter && (
                            <Chip
                                size="small"
                                color="primary"
                                label={`Priority: ${priorityFilter}`}
                                onDelete={() => setPriorityFilter('')}
                            />
                        )}
                        {executorFilter && (
                            <Chip
                                size="small"
                                color="primary"
                                label={`Executor: ${executorFilter}`}
                                onDelete={() => setExecutorFilter(null)}
                            />
                        )}
                        {(dueFrom || dueTo) && (
                            <Chip
                                size="small"
                                color="primary"
                                label={`Due: ${dueFrom ? dueFrom.toLocaleDateString() : '…'} – ${dueTo ? dueTo.toLocaleDateString() : '…'}`}
                                onDelete={() => {
                                    setDueFrom(null);
                                    setDueTo(null);
                                }}
                            />
                        )}
                    </Box>
                )}

                <TableContainer component={Box}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                {columnVisibility.taskId && (
                                    <TableCell width={100} align="center">
                                        <strong>ID</strong>
                                    </TableCell>
                                )}
                                {columnVisibility.task && (
                                    <TableCell sx={{ minWidth: 280, width: '28%' }}>
                                        <strong>Задача</strong>
                                    </TableCell>
                                )}
                                {columnVisibility.status && (
                                    <TableCell width={200} align="center">
                                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                            <strong>Статус</strong>
                                            {showFilters && (
                                                <Tooltip title="Фильтр по статусу">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => handleFilterIconClick(e, 'status')}
                                                        sx={{ color: statusFilter ? 'success.main' : undefined }}
                                                        aria-label="filter by status"
                                                    >
                                                        <FilterListIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Box>
                                    </TableCell>
                                )}
                                {columnVisibility.priority && (
                                    <TableCell width={180} align="center">
                                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                            <strong>Приоритет</strong>
                                            {showFilters && (
                                                <Tooltip title="Фильтр по приоритету">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => handleFilterIconClick(e, 'priority')}
                                                        sx={{ color: priorityFilter ? 'success.main' : undefined }}
                                                        aria-label="filter by priority"
                                                    >
                                                        <FilterListIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Box>
                                    </TableCell>
                                )}
                                {columnVisibility.executor && (
                                    <TableCell width={320}>
                                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                            <strong>Исполнитель</strong>
                                            {showFilters && (
                                                <Tooltip title="Фильтр по исполнителю">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => handleFilterIconClick(e, 'executor')}
                                                        sx={{ color: executorFilter ? 'success.main' : undefined }}
                                                        aria-label="filter by executor"
                                                    >
                                                        <PersonSearchIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Box>
                                    </TableCell>
                                )}
                                {columnVisibility.due && (
                                    <TableCell width={220} align="center">
                                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                            <strong>Срок</strong>
                                            {showFilters && (
                                                <Tooltip title="Фильтр по сроку (От/До)">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => handleFilterIconClick(e, 'due')}
                                                        sx={{ color: (dueFrom || dueTo) ? 'success.main' : undefined }}
                                                        aria-label="filter by due date"
                                                    >
                                                        <FilterListIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Box>
                                    </TableCell>
                                )}
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {pageSlice.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <Typography color="text.secondary">Пока нет задач.</Typography>
                                    </TableCell>
                                </TableRow>
                            )}

                            {pageSlice.map((t) => {
                                const statusTitle = t._statusTitle;
                                const safePriority = (normalizePriority(t.priority as string) ?? 'medium') as Pri;
                                const execLabel = t.executorName || t.executorEmail || '';
                                const execSub = t.executorName && t.executorEmail ? t.executorEmail : '';

                                return (

                                    <TableRow
                                        key={t._id}
                                        data-task-id={t._id}
                                        onClick={(e) => {
                                            if (e.button !== 0) return;
                                            openTaskPage(t);
                                        }}
                                        onContextMenuCapture={(e) => handleContextMenu(e, t)}
                                        sx={{
                                            transition: 'background-color .15s ease',
                                            cursor: 'pointer', // теперь логичнее pointer
                                            '&:hover': { backgroundColor: '#fffde7' },
                                        }}
                                    >

                                    {columnVisibility.taskId && <TableCell align="center">{t.taskId}</TableCell>}

                                        {columnVisibility.task && (
                                            <TableCell>
                                                <Stack spacing={0.5}>
                                                    <Typography>{t.taskName}</Typography>
                                                    {t.bsNumber && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            BS: {t.bsNumber}
                                                        </Typography>
                                                    )}
                                                </Stack>
                                            </TableCell>
                                        )}

                                        {columnVisibility.status && (
                                            <TableCell align="center">
                                                <Chip
                                                    size="small"
                                                    label={STATUS_LABELS_RU[statusTitle] ?? statusTitle}
                                                    variant="outlined"
                                                    sx={{ backgroundColor: getStatusColor(statusTitle), color: '#fff', borderColor: 'transparent' }}
                                                />
                                            </TableCell>
                                        )}

                                        {columnVisibility.priority && (
                                            <TableCell align="center">
                                                {getPriorityIcon(safePriority) ? (
                                                    <Tooltip title={getPriorityLabelRu(safePriority)}>
                                                        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                                                            {getPriorityIcon(safePriority)}
                                                        </Box>
                                                    </Tooltip>
                                                ) : (
                                                    <Typography variant="body2" color="text.secondary">
                                                        —
                                                    </Typography>
                                                )}
                                            </TableCell>
                                        )}

                                        {columnVisibility.executor && (
                                            <TableCell>
                                                {execLabel ? (
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <Avatar sx={{ width: 24, height: 24 }}>
                                                            {getInitials(t.executorName || t.executorEmail)}
                                                        </Avatar>
                                                        <Box>
                                                            <Typography variant="body2">{execLabel}</Typography>
                                                            {execSub && (
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {execSub}
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    </Stack>
                                                ) : (
                                                    <Typography variant="body2" color="text.secondary">—</Typography>
                                                )}
                                            </TableCell>
                                        )}

                                        {columnVisibility.due && <TableCell align="center">{formatDate(t.dueDate)}</TableCell>}
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>

                {/* пагинация */}
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', p: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel id="rows-per-page-label">Items</InputLabel>
                        <Select
                            labelId="rows-per-page-label"
                            label="Items"
                            value={rowsPerPage}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                setRowsPerPage(v);
                                setPage(1);
                            }}
                        >
                            <MenuItem value={10}>10</MenuItem>
                            <MenuItem value={50}>50</MenuItem>
                            <MenuItem value={100}>100</MenuItem>
                            <MenuItem value={-1}>Все</MenuItem>
                        </Select>
                    </FormControl>

                    <Pagination
                        count={totalPages}
                        page={page}
                        onChange={(_, p) => setPage(p)}
                        color="primary"
                        showFirstButton
                        showLastButton
                    />
                </Box>

                {/* popover фильтров */}
                <Popover
                    open={openFilterPopover}
                    anchorEl={anchorEl}
                    onClose={closeFilterPopover}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    slotProps={{ paper: { sx: { overflow: 'visible' } } }}
                >
                    <Box sx={{ p: 1.5, minWidth: popoverMinWidth }}>
                        {/* ... оставляем твои фильтры без изменений ... */}
                        {currentFilter === 'status' && (
                            <FormControl fullWidth variant="outlined" size="small">
                                <InputLabel id="status-filter-label">Статус</InputLabel>
                                <Select
                                    labelId="status-filter-label"
                                    value={statusFilter}
                                    label="Статус"
                                    onChange={(e) => setStatusFilter(e.target.value as StatusTitle | '')}
                                    autoFocus
                                >
                                    <MenuItem value="">
                                        <em>Все</em>
                                    </MenuItem>
                                    {STATUS_ORDER.map((s) => (
                                        <MenuItem key={s} value={s}>
                                            {STATUS_LABELS_RU[s] ?? s}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        {currentFilter === 'priority' && (
                            <FormControl fullWidth variant="outlined" size="small">
                                <InputLabel id="priority-filter-label">Приоритет</InputLabel>
                                <Select
                                    labelId="priority-filter-label"
                                    label="Приоритет"
                                    value={priorityFilter}
                                    onChange={(e) => {
                                        const v = e.target.value as '' | Priority;
                                        setPriorityFilter(v);
                                    }}
                                    autoFocus
                                >
                                    <MenuItem value="">
                                        <em>All</em>
                                    </MenuItem>
                                    <MenuItem value="low">low</MenuItem>
                                    <MenuItem value="medium">medium</MenuItem>
                                    <MenuItem value="high">high</MenuItem>
                                    <MenuItem value="urgent">urgent</MenuItem>
                                </Select>
                            </FormControl>
                        )}

                        {currentFilter === 'executor' && (
                            <Box sx={{ width: 360 }}>
                                <Autocomplete<string, false, false, false>
                                    options={uniqueExecutors}
                                    value={executorFilter}
                                    onChange={(_e, val) => setExecutorFilter(val)}
                                    clearOnEscape
                                    handleHomeEndKeys
                                    fullWidth
                                    renderInput={(params) => (
                                        <TextField {...params} label="Исполнитель" size="small" autoFocus />
                                    )}
                                    slotProps={{ popper: { disablePortal: true } }}
                                />
                            </Box>
                        )}

                        {currentFilter === 'due' && (
                            <Stack spacing={1} sx={{ width: 300 }}>
                                <DatePicker
                                    label="От"
                                    value={dueFrom}
                                    onChange={(v: Date | null) => setDueFrom(v)}
                                    slotProps={{ textField: { size: 'small' }, popper: { disablePortal: true } }}
                                />
                                <DatePicker
                                    label="До"
                                    value={dueTo}
                                    onChange={(v: Date | null) => setDueTo(v)}
                                    slotProps={{ textField: { size: 'small' }, popper: { disablePortal: true } }}
                                />
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 0.5 }}>
                                    <Button
                                        size="small"
                                        variant="text"
                                        onClick={() => {
                                            setDueFrom(null);
                                            setDueTo(null);
                                        }}
                                    >
                                        Сбросить
                                    </Button>
                                    <Button size="small" variant="contained" onClick={closeFilterPopover}>
                                        Применить
                                    </Button>
                                </Box>
                            </Stack>
                        )}
                    </Box>
                </Popover>

                {/* popover колонок */}
                <Popover
                    open={openColumnsPopover}
                    anchorEl={columnsAnchor}
                    onClose={closeColumnsPopover}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                >
                    <Box sx={{ p: 2, minWidth: 260 }}>
                        <List dense>
                            {Object.keys(columnVisibility).map((key) => (
                                <ListItem key={key}>
                                    <ListItemIcon>
                                        <Checkbox checked={columnVisibility[key]} onChange={() => toggleColumn(key)} />
                                    </ListItemIcon>
                                    <ListItemText primary={key[0].toUpperCase() + key.slice(1)} />
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                </Popover>

                {/* контекстное меню */}
                <Menu
                    open={!!menuPos}
                    onClose={handleCloseMenu}
                    anchorReference="anchorPosition"
                    anchorPosition={menuPos ?? undefined}
                    slotProps={{
                        paper: {
                            sx: {
                                minWidth: 220,
                                borderRadius: 3,
                                backgroundColor: menuBg,
                                border: `1px solid ${menuBorder}`,
                                boxShadow: menuShadow,
                                backdropFilter: 'blur(18px)',
                                px: 1,
                                py: 0.5,
                            },
                        },
                    }}
                    MenuListProps={{ sx: { py: 0 } }}
                >
                    <MMenuItem
                        sx={{
                            borderRadius: 2,
                            color: menuText,
                            px: 1.5,
                            py: 1,
                            gap: 1.5,
                            transition: 'background-color 0.2s ease',
                            '&:hover': { backgroundColor: menuItemHover },
                        }}
                        onClick={() => {
                            if (selectedTask) {
                                openTaskPage(selectedTask);
                            }
                            handleCloseMenu();
                        }}
                    >

                    <MListItemIcon sx={{ minWidth: 0 }}>
                            <Box
                                sx={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 2,
                                    backgroundColor: menuIconBg,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: menuIconColor,
                                }}
                            >
                                <OpenInNewIcon fontSize="small" />
                            </Box>
                        </MListItemIcon>
                        <MListItemText primary="Открыть" />
                    </MMenuItem>

                    <MMenuItem
                        sx={{
                            borderRadius: 2,
                            color: menuText,
                            px: 1.5,
                            py: 1,
                            gap: 1.5,
                            transition: 'background-color 0.2s ease',
                            '&:hover': { backgroundColor: menuItemHover },
                        }}
                        onClick={() => {
                            handleEditTask();
                            handleCloseMenu();
                        }}
                    >
                        <MListItemIcon sx={{ minWidth: 0 }}>
                            <Box
                                sx={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 2,
                                    backgroundColor: menuIconBg,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: menuIconColor,
                                }}
                            >
                                <EditNoteOutlinedIcon fontSize="small" />
                            </Box>
                        </MListItemIcon>
                        <MListItemText primary="Редактировать" />
                    </MMenuItem>

                    <Divider sx={{ borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.1)' }} />

                    <MMenuItem
                        sx={{
                            borderRadius: 2,
                            color: menuIconDangerColor,
                            px: 1.5,
                            py: 1,
                            gap: 1.5,
                            transition: 'background-color 0.2s ease',
                            '&:hover': { backgroundColor: menuIconDangerBg },
                        }}
                        onClick={() => {
                            askDelete();
                            handleCloseMenu();
                        }}
                    >
                        <MListItemIcon sx={{ minWidth: 0 }}>
                            <Box
                                sx={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 2,
                                    backgroundColor: menuIconDangerBg,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: menuIconDangerColor,
                                }}
                            >
                                <DeleteOutlineIcon fontSize="small" />
                            </Box>
                        </MListItemIcon>
                        <MListItemText primary="Удалить" />
                    </MMenuItem>
                </Menu>

                {/* диалог удаления */}
                <Dialog open={deleteOpen} onClose={deleteLoading ? undefined : handleCancelDelete}>
                    <DialogTitle>Удалить задачу?</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            Это действие нельзя отменить. Будет удалена задача
                            {selectedTask ? ` «${selectedTask.taskName}»` : ''}.
                        </DialogContentText>
                        {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCancelDelete} disabled={deleteLoading}>
                            Отмена
                        </Button>
                        <Button onClick={handleConfirmDelete} variant="contained" color="error" disabled={deleteLoading}>
                            {deleteLoading ? 'Удаляю…' : 'Удалить'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* диалог редактирования */}
                {selectedTask && (
                    <WorkspaceTaskDialog
                        open={editOpen}
                        org={org}
                        project={project}
                        mode="edit"
                        initialTask={{
                            _id: selectedTask._id,
                            taskId: selectedTask.taskId,
                            taskName: selectedTask.taskName,
                            status: selectedTask.status,
                            dueDate: selectedTask.dueDate,
                            bsNumber: selectedTask.bsNumber,
                            bsAddress: selectedTask.bsAddress,
                            taskDescription: selectedTask.taskDescription,
                            bsLatitude: selectedTask.bsLatitude,
                            bsLongitude: selectedTask.bsLongitude,
                            totalCost: selectedTask.totalCost,
                            priority: (normalizePriority(selectedTask.priority as string) ?? 'medium') as Pri,
                            executorId: selectedTask.executorId,
                            executorName: selectedTask.executorName,
                            executorEmail: selectedTask.executorEmail,
                            files: selectedTask.files,
                            attachments: selectedTask.attachments,
                            bsLocation: selectedTask.bsLocation,
                        } as TaskForEdit}
                        onCloseAction={() => setEditOpen(false)}
                        onCreatedAction={handleEdited}
                    />
                )}
            </Box>
        </LocalizationProvider>
    );
});

ProjectTaskList.displayName = 'ProjectTaskList';

export default ProjectTaskList;

/* helpers */
function startOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function endOfDay(d: Date) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

// src/app/workspace/components/ProjectTaskList.tsx
'use client';

import React, { useMemo, useState } from 'react';
import {
    Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
    IconButton, Tooltip, Chip, Popover, FormControl, InputLabel, Select, MenuItem,
    TextField, Checkbox, List, ListItem, ListItemIcon, ListItemText, Pagination, Alert, Avatar, Stack
} from '@mui/material';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';

/* ───────────── типы ───────────── */
type Status = 'TO DO' | 'IN PROGRESS' | 'DONE';
type Priority = 'urgent' | 'high' | 'medium' | 'low';

type Task = {
    _id: string;
    taskId: string;
    taskName: string;
    status?: Status | string;
    assignees?: Array<{ name?: string; email?: string; avatarUrl?: string }>;
    dueDate?: string;
    createdAt?: string;
    bsNumber?: string;
    totalCost?: number;
    priority?: Priority | string;
};

/* ───────────── константы ───────────── */
const STATUS_COLOR: Record<Status, 'default' | 'primary' | 'success' | 'warning' | 'info' | 'error'> = {
    'TO DO': 'default',
    'IN PROGRESS': 'info',
    'DONE': 'success',
};

const formatDate = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ru-RU');
};

/* нормализаторы */
const normStatus = (s?: string): Status =>
    (s ? s.toString() : 'TO DO').toUpperCase() as Status;

const normPriority = (p?: string): Priority | '' =>
    p ? (p.toString().toLowerCase() as Priority) : '';

/* ───────────── компонент ───────────── */
export default function ProjectTaskList({
                                            items,
                                            loading,
                                            error,
                                        }: {
    items: Task[];
    loading: boolean;
    error: string | null;
}) {
    // ── фильтры ─────────────────────────────────────────────────────────
    const [status, setStatus] = useState<'' | Status>('');
    const [priority, setPriority] = useState<'' | Priority>('');
    const [bsQuery, setBsQuery] = useState('');

    // ── колонки ────────────────────────────────────────────────────────
    const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
        taskId: true,
        task: true,
        assignees: true,
        status: true,
        priority: true,
        due: true,
    });
    const toggleColumn = (key: string) =>
        setColumnVisibility((v) => ({ ...v, [key]: !v[key] }));

    // ── поповер ────────────────────────────────────────────────────────
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [currentFilter, setCurrentFilter] = useState<string>('');
    const openPopover = (e: React.MouseEvent<HTMLElement>, type: string) => {
        setAnchorEl(e.currentTarget);
        setCurrentFilter(type);
    };
    const closePopover = () => {
        setAnchorEl(null);
        setCurrentFilter('');
    };

    // ── пагинация ──────────────────────────────────────────────────────
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState<number>(10);

    // ── применяем фильтры к props.items ────────────────────────────────
    const filtered = useMemo(() => {
        let res = [...items];

        if (status) {
            res = res.filter((t) => normStatus(t.status as string) === status);
        }
        if (priority) {
            res = res.filter((t) => normPriority(t.priority as string) === priority);
        }
        if (bsQuery) {
            const q = bsQuery.toLowerCase();
            res = res.filter((t) => (t.bsNumber || '').toLowerCase().includes(q));
        }
        return res;
    }, [items, status, priority, bsQuery]);

    const totalPages = rowsPerPage === -1 ? 1 : Math.max(1, Math.ceil(filtered.length / rowsPerPage));
    const pageSlice =
        rowsPerPage === -1
            ? filtered
            : filtered.slice((page - 1) * rowsPerPage, (page - 1) * rowsPerPage + rowsPerPage);

    // ── UI ─────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">Загрузка…</Typography>
            </Box>
        );
    }
    if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;

    return (
        <Box>
            {/* верхняя панель фильтров */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1, pb: 1 }}>
                <Tooltip title="Управление колонками">
                    <IconButton onClick={(e) => openPopover(e, 'columns')}>
                        <ViewColumnIcon />
                    </IconButton>
                </Tooltip>

                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                        label="Status"
                        value={status}
                        onChange={(e) => {
                            setStatus(e.target.value as '' | Status);
                            setPage(1);
                        }}
                    >
                        <MenuItem value=""><em>All</em></MenuItem>
                        <MenuItem value="TO DO">TO DO</MenuItem>
                        <MenuItem value="IN PROGRESS">IN PROGRESS</MenuItem>
                        <MenuItem value="DONE">DONE</MenuItem>
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Priority</InputLabel>
                    <Select
                        label="Priority"
                        value={priority}
                        onChange={(e) => {
                            setPriority(e.target.value as '' | Priority);
                            setPage(1);
                        }}
                    >
                        <MenuItem value=""><em>All</em></MenuItem>
                        <MenuItem value="low">low</MenuItem>
                        <MenuItem value="medium">medium</MenuItem>
                        <MenuItem value="high">high</MenuItem>
                        <MenuItem value="urgent">urgent</MenuItem>
                    </Select>
                </FormControl>

                <Tooltip title="Search BS">
                    <IconButton onClick={(e) => openPopover(e, 'bs')} color={bsQuery ? 'primary' : 'default'}>
                        <SearchIcon />
                    </IconButton>
                </Tooltip>

                {/* чипы активных фильтров */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', ml: 'auto' }}>
                    {status && <Chip size="small" color="primary" label={`Status: ${status}`} onDelete={() => setStatus('')} />}
                    {priority && <Chip size="small" color="primary" label={`Priority: ${priority}`} onDelete={() => setPriority('')} />}
                    {bsQuery && <Chip size="small" color="primary" label={`BS: ${bsQuery}`} onDelete={() => setBsQuery('')} />}
                </Box>
            </Box>

            <TableContainer component={Box}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            {columnVisibility.taskId && <TableCell width={100} align="center"><strong>ID</strong></TableCell>}
                            {columnVisibility.task && <TableCell><strong>Task</strong></TableCell>}
                            {columnVisibility.status && <TableCell width={160} align="center"><strong>Status</strong></TableCell>}
                            {columnVisibility.priority && <TableCell width={140} align="center"><strong>Priority</strong></TableCell>}
                            {columnVisibility.assignees && <TableCell width={240}><strong>Assignees</strong></TableCell>}
                            {columnVisibility.due && <TableCell width={140} align="center"><strong>Due date</strong></TableCell>}
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
                            const safeStatus = normStatus(t.status as string);
                            const safePriority = (normPriority(t.priority as string) || 'medium') as Priority;

                            return (
                                <TableRow key={t._id}>
                                    {columnVisibility.taskId && <TableCell align="center">{t.taskId}</TableCell>}

                                    {columnVisibility.task && (
                                        <TableCell>
                                            <Stack spacing={0.5}>
                                                <Typography fontWeight={600}>{t.taskName}</Typography>
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
                                                variant="outlined"
                                                label={safeStatus}
                                                color={STATUS_COLOR[safeStatus] ?? 'default'}
                                            />
                                        </TableCell>
                                    )}

                                    {columnVisibility.priority && (
                                        <TableCell align="center">
                                            <Chip size="small" variant="outlined" label={safePriority} />
                                        </TableCell>
                                    )}

                                    {columnVisibility.assignees && (
                                        <TableCell>
                                            {!t.assignees || t.assignees.length === 0 ? (
                                                <Typography variant="body2" color="text.secondary">—</Typography>
                                            ) : (
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    {t.assignees.slice(0, 2).map((a, i) => (
                                                        <Stack key={i} direction="row" spacing={1} alignItems="center">
                                                            <Avatar sx={{ width: 24, height: 24 }} src={a.avatarUrl}>
                                                                {(a.name || a.email || '?').slice(0, 1).toUpperCase()}
                                                            </Avatar>
                                                            <Typography variant="body2">{a.name || a.email}</Typography>
                                                        </Stack>
                                                    ))}
                                                    {t.assignees.length > 2 && (
                                                        <Chip size="small" label={`+${t.assignees.length - 2}`} variant="outlined" />
                                                    )}
                                                </Stack>
                                            )}
                                        </TableCell>
                                    )}

                                    {columnVisibility.due && (
                                        <TableCell align="center">{formatDate(t.dueDate)}</TableCell>
                                    )}
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* пагинация + размер страницы */}
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

            {/* Popover: колонки / BS-поиск */}
            <Popover
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                onClose={closePopover}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
                <Box sx={{ p: 2, minWidth: 240 }}>
                    {currentFilter === 'columns' && (
                        <>
                            <List dense>
                                {Object.keys(columnVisibility).map((key) => (
                                    <ListItem key={key} component="button">
                                        <ListItemIcon>
                                            <Checkbox
                                                checked={columnVisibility[key]}
                                                onChange={() => toggleColumn(key)}
                                            />
                                        </ListItemIcon>
                                        <ListItemText primary={key[0].toUpperCase() + key.slice(1)} />
                                    </ListItem>
                                ))}
                            </List>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                <IconButton
                                    aria-label="show all"
                                    onClick={() =>
                                        setColumnVisibility(Object.fromEntries(Object.keys(columnVisibility).map(k => [k, true])))
                                    }
                                >
                                    <FilterListIcon />
                                </IconButton>
                                <IconButton
                                    aria-label="hide all"
                                    onClick={() =>
                                        setColumnVisibility(Object.fromEntries(Object.keys(columnVisibility).map(k => [k, false])))
                                    }
                                >
                                    <FilterListIcon color="disabled" />
                                </IconButton>
                            </Box>
                        </>
                    )}

                    {currentFilter === 'bs' && (
                        <TextField
                            label="Search BS"
                            value={bsQuery}
                            onChange={(e) => {
                                setBsQuery(e.target.value);
                                setPage(1);
                            }}
                            fullWidth
                            autoFocus
                        />
                    )}
                </Box>
            </Popover>
        </Box>
    );
}

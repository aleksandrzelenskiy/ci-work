// src/app/org/[org]/projects/[project]/tasks/page.tsx
'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
    Box, Stack, Typography, Button, Tabs, Tab, Paper, Table, TableHead, TableRow,
    TableCell, TableBody, Chip, Avatar, TextField, IconButton, Tooltip, Divider,
    Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import WorkspaceTaskDialog from '@/app/workspace/components/WorkspaceTaskDialog';

type Task = {
    _id: string;
    taskId: string;
    taskName: string;
    status?: string;
    assignees?: Array<{ name?: string; email?: string; avatarUrl?: string }>;
    dueDate?: string;
    createdAt?: string;
    bsNumber?: string;
    totalCost?: number;
    priority?: 'urgent' | 'high' | 'medium' | 'low';
};

type ApiListResponse =
    | { ok: true; page: number; limit: number; total: number; items: Task[] }
    | { error: string };

const STATUS_ORDER = ['TO DO', 'IN PROGRESS', 'DONE'] as const;
const STATUS_COLOR: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'info' | 'error'> = {
    'TO DO': 'default',
    'IN PROGRESS': 'info',
    DONE: 'success',
};

export default function ProjectTasksPage() {
    const params = useParams<{ org: string; project: string }>() as { org: string; project: string };
    const org = params.org;
    const project = params.project;

    const [tab, setTab] = React.useState<'list' | 'board' | 'calendar'>('list');
    const [open, setOpen] = React.useState(false);
    const [q, setQ] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [items, setItems] = React.useState<Task[]>([]);
    const [error, setError] = React.useState<string | null>(null);

    const load = React.useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const url = new URL(`/api/org/${org}/projects/${project}/tasks`, window.location.origin);
            if (q) url.searchParams.set('q', q);
            url.searchParams.set('limit', '200');
            const res = await fetch(url.toString(), { cache: 'no-store' });
            const data: ApiListResponse = await res.json();
            if (!('ok' in data)) {
                setError(data.error || 'Failed to load');
                setItems([]);
            } else {
                setItems(data.items || []);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Network error');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [org, project, q]);

    React.useEffect(() => {
        void load();
    }, [load]);

    return (
        <Box sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="h5" fontWeight={700}>Задачи проекта</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Организация: {org} · Проект: {project}
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                    <Tooltip title="Обновить">
                        <span>
                            <IconButton onClick={() => void load()} disabled={loading}>
                                <RefreshIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Button onClick={() => setOpen(true)} variant="contained" startIcon={<AddIcon />}>
                        Создать задачу
                    </Button>
                </Stack>
            </Stack>

            <Paper variant="outlined" sx={{ p: 1, mb: 2 }}>
                <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                        size="small"
                        label="Поиск (id, имя, BS…)"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void load(); }}
                        sx={{ width: 360, maxWidth: '100%' }}
                    />
                    <Button onClick={() => void load()} variant="outlined">Искать</Button>
                </Stack>
            </Paper>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
                <Tab value="list" label="Список" />
                <Tab value="board" label="Канбан" />
                <Tab value="calendar" label="Календарь" />
            </Tabs>

            {tab === 'list' && <ListView items={items} loading={loading} error={error} />}
            {tab === 'board' && <BoardView items={items} loading={loading} error={error} />}
            {tab === 'calendar' && <CalendarView items={items} loading={loading} error={error} />}

            <WorkspaceTaskDialog
                open={open}
                org={org}
                // сюда передаем KEY проекта; диалог сформирует URL с этим значением
                project={project}
                onCloseAction={() => setOpen(false)}
                onCreatedAction={() => {
                    setOpen(false);
                    void load();
                }}
            />
        </Box>
    );
}

/* ======================= LIST ======================= */

function ListView({ items, loading, error }: { items: Task[]; loading: boolean; error: string | null }) {
    return (
        <Paper variant="outlined">
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell width={100}>Key</TableCell>
                        <TableCell>Summary</TableCell>
                        <TableCell width={160}>Status</TableCell>
                        <TableCell width={140}>Priority</TableCell>
                        <TableCell width={220}>Assignee</TableCell>
                        <TableCell width={140}>Due date</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {loading && Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={`sk-${i}`}>
                            <TableCell> </TableCell>
                            <TableCell> </TableCell>
                            <TableCell> </TableCell>
                            <TableCell> </TableCell>
                            <TableCell> </TableCell>
                            <TableCell> </TableCell>
                        </TableRow>
                    ))}

                    {!loading && error && (
                        <TableRow><TableCell colSpan={6}><Typography color="error">{error}</Typography></TableCell></TableRow>
                    )}

                    {!loading && !error && items.length === 0 && (
                        <TableRow><TableCell colSpan={6}><Typography color="text.secondary">Пока нет задач.</Typography></TableCell></TableRow>
                    )}

                    {!loading && !error && items.map((t) => (
                        <TableRow key={t._id}>
                            <TableCell sx={{ whiteSpace: 'nowrap' }}>{t.taskId}</TableCell>
                            <TableCell>
                                <Stack spacing={0.5}>
                                    <Typography fontWeight={600}>{t.taskName}</Typography>
                                    {t.bsNumber && <Typography variant="caption" color="text.secondary">BS: {t.bsNumber}</Typography>}
                                </Stack>
                            </TableCell>
                            <TableCell>
                                <Chip size="small" label={t.status || 'TO DO'} color={STATUS_COLOR[t.status || 'TO DO'] ?? 'default'} variant="outlined" />
                            </TableCell>
                            <TableCell>
                                <Chip size="small" label={t.priority || 'medium'} variant="outlined" />
                            </TableCell>
                            <TableCell><AssigneesInline assignees={t.assignees} /></TableCell>
                            <TableCell>{formatDate(t.dueDate)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Paper>
    );
}

function AssigneesInline({ assignees }: { assignees?: Task['assignees'] }) {
    if (!assignees || assignees.length === 0) return <Typography variant="body2" color="text.secondary">—</Typography>;
    return (
        <Stack direction="row" spacing={1} alignItems="center">
            {assignees.slice(0, 2).map((a, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="center">
                    <Avatar sx={{ width: 24, height: 24 }} src={a.avatarUrl}>
                        {(a.name || a.email || '?').slice(0, 1).toUpperCase()}
                    </Avatar>
                    <Typography variant="body2">{a.name || a.email}</Typography>
                </Stack>
            ))}
            {assignees.length > 2 && <Chip size="small" label={`+${assignees.length - 2}`} variant="outlined" />}
        </Stack>
    );
}

/* ======================= BOARD ======================= */

function BoardView({ items, loading, error }: { items: Task[]; loading: boolean; error: string | null }) {
    const grouped = React.useMemo(() => {
        const map: Record<string, Task[]> = { 'TO DO': [], 'IN PROGRESS': [], 'DONE': [] };
        for (const t of items) {
            const st = (t.status || 'TO DO').toUpperCase();
            (map[st] || (map['TO DO'] = map['TO DO'])).push(t);
        }
        return map;
    }, [items]);

    return (
        <Box>
            {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}
            <Grid container spacing={2}>
                {STATUS_ORDER.map((col) => (
                    <Grid key={col} item xs={12} md={4}>
                        <Paper variant="outlined" sx={{ height: '70vh', p: 1, display: 'flex', flexDirection: 'column' }}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1, py: 0.5 }}>
                                <Chip size="small" label={col} color={STATUS_COLOR[col] ?? 'default'} variant="outlined" />
                                <Typography variant="body2" color="text.secondary">{grouped[col]?.length || 0}</Typography>
                            </Stack>
                            <Divider sx={{ my: 1 }} />
                            <Box sx={{ flex: 1, overflow: 'auto' }}>
                                {loading ? (
                                    Array.from({ length: 4 }).map((_, i) => (
                                        <Paper key={i} variant="outlined" sx={{ p: 1, mb: 1 }}>
                                            <Typography> </Typography><Typography> </Typography>
                                        </Paper>
                                    ))
                                ) : (grouped[col]?.length ? grouped[col].map((t) => (
                                    <Paper key={t._id} variant="outlined" sx={{ p: 1.2, mb: 1.2 }}>
                                        <Typography variant="caption" color="text.secondary">{t.taskId}</Typography>
                                        <Typography fontWeight={700} sx={{ mt: 0.5, mb: 0.5 }}>{t.taskName}</Typography>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                                            <AssigneesCompact assignees={t.assignees} />
                                            <Typography variant="caption">{formatDate(t.dueDate)}</Typography>
                                        </Stack>
                                    </Paper>
                                )) : (
                                    <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>Нет задач в этой колонке.</Typography>
                                ))}
                            </Box>
                        </Paper>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}

function AssigneesCompact({ assignees }: { assignees?: Task['assignees'] }) {
    if (!assignees || assignees.length === 0) return <Box />;
    return (
        <Stack direction="row" spacing={0.5}>
            {assignees.slice(0, 3).map((a, i) => (
                <Tooltip key={i} title={a.name || a.email || ''}>
                    <Avatar sx={{ width: 22, height: 22 }} src={a.avatarUrl}>
                        {(a.name || a.email || '?').slice(0, 1).toUpperCase()}
                    </Avatar>
                </Tooltip>
            ))}
        </Stack>
    );
}

/* ======================= CALENDAR ======================= */

function CalendarView({ items, loading, error }: { items: Task[]; loading: boolean; error: string | null }) {
    const [cursor, setCursor] = React.useState(() => startOfMonth(new Date()));
    const monthDays = React.useMemo(() => buildMonthGrid(cursor), [cursor]);
    const byDate = React.useMemo(() => {
        const m = new Map<string, Task[]>();
        for (const t of items) {
            if (!t.dueDate) continue;
            const key = toYMD(new Date(t.dueDate));
            if (!m.has(key)) m.set(key, []);
            m.get(key)!.push(t);
        }
        return m;
    }, [items]);

    return (
        <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <IconButton onClick={() => setCursor(addMonths(cursor, -1))}><ChevronLeftIcon /></IconButton>
                    <IconButton onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRightIcon /></IconButton>
                    <Typography variant="h6" fontWeight={700}>
                        {cursor.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}
                    </Typography>
                </Stack>
            </Stack>

            {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}

            <Paper variant="outlined" sx={{ p: 1 }}>
                <Grid container columns={7} spacing={0.5}>
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
                        <Grid key={d} item xs={1}>
                            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ pl: 1 }}>
                                {d}
                            </Typography>
                        </Grid>
                    ))}
                </Grid>

                <Divider sx={{ my: 1 }} />

                <Grid container columns={7} spacing={0.5}>
                    {monthDays.map((cell, i) => {
                        const key = toYMD(cell.date);
                        const tasks = byDate.get(key) || [];
                        const faded = cell.date.getMonth() !== cursor.getMonth();
                        return (
                            <Grid key={i} item xs={1}>
                                <Box sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    minHeight: 120,
                                    p: 1,
                                    backgroundColor: faded ? 'action.hover' : 'background.paper',
                                }}>
                                    <Typography variant="caption" color="text.secondary">
                                        {cell.date.getDate()}
                                    </Typography>
                                    <Stack spacing={0.5} sx={{ mt: 0.5, maxHeight: 90, overflow: 'auto' }}>
                                        {loading ? (
                                            <>
                                                <Typography variant="caption" color="text.disabled"> </Typography>
                                                <Typography variant="caption" color="text.disabled"> </Typography>
                                            </>
                                        ) : tasks.length ? tasks.map((t) => (
                                            <Chip
                                                key={t._id}
                                                size="small"
                                                label={`${t.taskId} · ${t.taskName}`}
                                                color={STATUS_COLOR[t.status || 'TO DO'] ?? 'default'}
                                                variant="outlined"
                                                sx={{ maxWidth: '100%' }}
                                            />
                                        )) : (
                                            <Typography variant="caption" color="text.disabled">—</Typography>
                                        )}
                                    </Stack>
                                </Box>
                            </Grid>
                        );
                    })}
                </Grid>
            </Paper>
        </Box>
    );
}

/* ======================= DATE UTILS ======================= */

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function toYMD(d: Date) {
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${day}`;
}
function buildMonthGrid(cursor: Date) {
    const first = startOfMonth(cursor);
    const weekday = (first.getDay() + 6) % 7; // 0=Mon
    const start = new Date(first);
    start.setDate(first.getDate() - weekday);
    return Array.from({ length: 42 }).map((_, i) => ({
        date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
    }));
}
function formatDate(iso?: string) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

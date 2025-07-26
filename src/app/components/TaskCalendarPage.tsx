// app/components/TaskCalendarPage.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
    Box,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Chip,
    Stack,
    Typography,
    Switch,
    FormControlLabel,
    ButtonGroup,
    Alert,
} from '@mui/material';
import {
    format,
    parse,
    startOfWeek,
    getDay,
    addHours,
    getISOWeek,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import {
    dateFnsLocalizer,
    type CalendarProps,
    type Event as RBCEvent,
} from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import {
    KeyboardDoubleArrowUp,
    KeyboardArrowUp,
    DragHandle,
    Remove,
    ArrowBackIos,
    ArrowForwardIos,
    Today,
} from '@mui/icons-material';
import { getStatusColor } from '@/utils/statusColors';
import { GetCurrentUserFromMongoDB } from 'src/server-actions/users';

/* ---------- Типы ---------- */

type Priority = 'urgent' | 'high' | 'medium' | 'low';
type ViewType = 'month' | 'week' | 'day';

interface Task {
    _id: string;
    taskId: string;
    taskName: string;
    bsNumber: string;
    bsAddress: string;
    totalCost: number;
    authorName?: string;
    initiatorName?: string;
    executorName?: string;
    executorId?: string;
    createdAt: string;
    dueDate: string;
    status: string;
    priority: Priority;
}

type CalendarEvent = RBCEvent<{ priority: Priority; status: string }>;

/* ---------- helpers (цвета, иконки) ---------- */

const prColors: Record<Priority, string> = {
    urgent: '#d32f2f',
    high: '#f57c00',
    medium: '#1976d2',
    low: '#388e3c',
};

const getPriorityIcon = (p: Priority) =>
    p === 'low'
        ? <Remove sx={{ color: prColors.low }} />
        : p === 'medium'
            ? <DragHandle sx={{ color: prColors.medium }} />
            : p === 'high'
                ? <KeyboardArrowUp sx={{ color: prColors.high }} />
                : <KeyboardDoubleArrowUp sx={{ color: prColors.urgent }} />;

const shortName = (v?: string) =>
    v ? v.replace(/\)$/, '').split(' (')[0] : 'N/A';

/* ---------- кастомный Toolbar ---------- */

interface ToolbarProps {
    label: string;
    view: ViewType;
    date: Date;
    onNavigate: (a: 'PREV' | 'NEXT' | 'TODAY' | 'DATE') => void;
    onView: (v: ViewType) => void;
}

function NavToolbar({ label, view, date, onNavigate, onView }: ToolbarProps) {
    const prefix = view === 'week' ? `W${getISOWeek(date)} — ` : '';
    return (
        <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between' }}>
            <ButtonGroup size="small">
                <Button onClick={() => onNavigate('PREV')}>
                    <ArrowBackIos fontSize="inherit" />
                </Button>
                <Button onClick={() => onNavigate('TODAY')}>
                    <Today fontSize="inherit" />
                </Button>
                <Button onClick={() => onNavigate('NEXT')}>
                    <ArrowForwardIos fontSize="inherit" />
                </Button>
            </ButtonGroup>

            <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                {prefix}
                {label}
            </Typography>

            <ButtonGroup size="small">
                {(['month', 'week', 'day'] as ViewType[]).map((v) => (
                    <Button
                        key={v}
                        variant={view === v ? 'contained' : 'outlined'}
                        onClick={() => onView(v)}
                    >
                        {v[0].toUpperCase() + v.slice(1)}
                    </Button>
                ))}
            </ButtonGroup>
        </Box>
    );
}

/* ---------- динамический импорт Calendar ---------- */

const Calendar = dynamic(
    () =>
        import('react-big-calendar').then(
            (m) => m.Calendar as React.ComponentType<CalendarProps<CalendarEvent>>
        ),
    { ssr: false }
);

/* ---------- Localizer ---------- */

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
    getDay,
    locales: { ru },
});

/* ---------- компонент ---------- */

export default function TaskCalendarPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    const [selected, setSelected] = useState<Task | null>(null);
    const [role, setRole] = useState<'admin' | 'executor' | 'other'>('other');
    const [showCompleted, setShowCompleted] = useState(false);

    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [view, setView] = useState<ViewType>('month');

    /* --- загрузка задач и роли --- */
    useEffect(() => {
        (async () => {
            try {
                const [taskRes, userRes] = await Promise.all([
                    fetch('/api/tasks'),
                    GetCurrentUserFromMongoDB(),
                ]);

                const { tasks: rawTasks } = await taskRes.json();
                const userData = userRes.success ? userRes.data : null;

                if (userData) setRole(userData.role as 'admin' | 'executor' | 'other');

                setTasks(rawTasks as Task[]);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    /* --- вычисляем события (hook всегда вызывается) --- */
    const events = useMemo<CalendarEvent[]>(() => {
        if (role === 'executor') return []; // executor календарь всё равно не видит

        const list = showCompleted
            ? tasks
            : tasks.filter((t) => !['Done', 'Fixed', 'Agreed'].includes(t.status));

        return list.map((t) => ({
            id: t._id,
            title: `${t.taskName} | ${t.bsNumber}`,
            start: new Date(t.dueDate),
            end: addHours(new Date(t.dueDate), 1),
            resource: { priority: t.priority, status: t.status },
        }));
    }, [tasks, showCompleted, role]);

    /* --- лоадер --- */
    if (loading)
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, p: 5 }}>
                <CircularProgress />
            </Box>
        );

    /* --- календарь недоступен для executor --- */
    if (role === 'executor')
        return (
            <Alert severity="info" sx={{ m: 4 }}>
                Календарь недоступен для вашей роли.
            </Alert>
        );

    /* --- основной рендер --- */
    return (
        <>
            <FormControlLabel
                control={
                    <Switch
                        checked={showCompleted}
                        onChange={(e) => setShowCompleted(e.target.checked)}
                        size="small"
                    />
                }
                label="Show completed"
                sx={{ mb: 1, ml: 2, mt: 2 }}
            />

            <Box sx={{ height: 'calc(100vh - 220px)' }}>
                <Calendar
                    localizer={localizer}
                    events={events}
                    date={currentDate}
                    view={view}
                    onNavigate={setCurrentDate}
                    onView={(v) => setView(v as ViewType)}
                    components={{ toolbar: NavToolbar as React.ComponentType<unknown> }}
                    views={{ month: true, week: true, day: true }}
                    popup
                    style={{ height: '100%' }}
                    eventPropGetter={(e) => ({
                        style: {
                            backgroundColor: getStatusColor(e.resource?.status || ''),
                            fontSize: '0.75rem',
                            lineHeight: 1.15,
                        },
                    })}
                    onSelectEvent={(e) => {
                        const t = tasks.find((x) => x._id === e.id);
                        if (t) setSelected(t);
                    }}
                />
            </Box>

            {/* -------- Dialog -------- */}
            <Dialog
                open={Boolean(selected)}
                onClose={() => setSelected(null)}
                fullWidth
                maxWidth="sm"
            >
                {selected && (
                    <>
                        <DialogTitle sx={{ fontSize: 16 }}>
                            {selected.taskName} | {selected.bsNumber}
                        </DialogTitle>

                        <DialogContent dividers>
                            <Stack direction="row" spacing={2} mb={2} flexWrap="wrap">
                                <Chip
                                    label={selected.status}
                                    sx={{
                                        backgroundColor: getStatusColor(selected.status),
                                        color: '#fff',
                                    }}
                                />
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    {getPriorityIcon(selected.priority)}
                                    <Typography>{selected.priority}</Typography>
                                </Stack>
                                <Typography variant="body2">
                                    Created:&nbsp;
                                    {format(new Date(selected.createdAt), 'dd.MM.yyyy')}
                                </Typography>
                                <Typography variant="body2">
                                    Due:&nbsp;
                                    {format(new Date(selected.dueDate), 'dd.MM.yyyy')}
                                </Typography>
                            </Stack>

                            <Stack spacing={1}>
                                <Typography variant="subtitle2">
                                    BS Number:&nbsp;{selected.bsNumber}
                                </Typography>
                                <Typography variant="subtitle2">
                                    Address:&nbsp;{selected.bsAddress}
                                </Typography>
                                <Typography variant="subtitle2">
                                    Author:&nbsp;{shortName(selected.authorName)}
                                </Typography>
                                <Typography variant="subtitle2">
                                    Initiator:&nbsp;{shortName(selected.initiatorName)}
                                </Typography>
                                <Typography variant="subtitle2">
                                    Executor:&nbsp;{shortName(selected.executorName)}
                                </Typography>
                                <Typography variant="subtitle2">
                                    Cost:&nbsp;{selected.totalCost}
                                </Typography>
                            </Stack>
                        </DialogContent>

                        <DialogActions>
                            <Button onClick={() => setSelected(null)}>Close</Button>
                            <Button
                                variant="contained"
                                onClick={() =>
                                    window.open(`/tasks/${selected.taskId.toLowerCase()}`, '_blank')
                                }
                            >
                                More
                            </Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>
        </>
    );
}

// src/app/workspace/components/ProjectTaskCalendar.tsx
'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
    Box, Chip, Stack, Typography,
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Alert, ButtonGroup
} from '@mui/material';

import {
    format, parse, startOfWeek, getDay, addHours, getISOWeek
} from 'date-fns';
import { ru } from 'date-fns/locale';
import {
    dateFnsLocalizer, type CalendarProps, type Event as RBCEvent,
} from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import ArrowBackIos from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIos from '@mui/icons-material/ArrowForwardIos';
import Today from '@mui/icons-material/Today';

/* ---------- Типы ---------- */
type Status = 'TO DO' | 'IN PROGRESS' | 'DONE';
type Priority = 'urgent' | 'high' | 'medium' | 'low';
type ViewType = 'month' | 'week' | 'day';

type Task = {
    _id: string;
    taskId: string;
    taskName: string;
    bsNumber?: string;
    bsAddress?: string;
    totalCost?: number;
    createdAt?: string;
    dueDate?: string;
    status?: Status | string;
    priority?: Priority | string;
};

type CalendarEvent = RBCEvent<{ priority?: Priority | string; status?: Status | string; id: string }>;

/* ---------- Цвета ---------- */
const prColors: Record<Priority, string> = {
    urgent: '#d32f2f',
    high: '#f57c00',
    medium: '#1976d2',
    low: '#388e3c',
};
const statusBg: Record<Status, string> = {
    'TO DO': '#9e9e9e',
    'IN PROGRESS': '#0288d1',
    'DONE': '#2e7d32',
};

/* ---------- Динамический импорт Calendar ---------- */
const Calendar = dynamic(
    () =>
        import('react-big-calendar').then(
            (m) => m.Calendar as unknown as React.ComponentType<CalendarProps<CalendarEvent>>
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

/* ---------- Кастомный Toolbar ---------- */
type ToolbarProps = {
    label: string;
    view: ViewType | string;
    date: Date;
    onNavigate: (a: 'PREV' | 'NEXT' | 'TODAY' | 'DATE') => void;
    onView: (v: ViewType | string) => void;
};

function Toolbar({ label, view, date, onNavigate, onView }: ToolbarProps) {
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

/* ---------- Компонент ---------- */
export default function ProjectTaskCalendar({
                                                items,
                                                loading,
                                                error,
                                            }: {
    items: Task[];
    loading: boolean;
    error: string | null;
}) {
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [view, setView] = useState<ViewType>('month');
    const [selected, setSelected] = useState<Task | null>(null);

    const events = useMemo<CalendarEvent[]>(() => {
        return items
            .filter((t) => t.dueDate)
            .map((t) => ({
                id: t._id,
                title: `${t.taskName} | ${t.bsNumber || ''}`,
                start: new Date(t.dueDate as string),
                end: addHours(new Date(t.dueDate as string), 1),
                resource: { priority: t.priority, status: t.status, id: t._id },
            }));
    }, [items]);

    if (loading) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">Загрузка…</Typography>
            </Box>
        );
    }
    if (error) return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;

    // подготавливаем components prop без any
    const calendarComponents = {
        toolbar: Toolbar,
    } as unknown as CalendarProps<CalendarEvent>['components'];

    return (
        <>
            <Box sx={{ height: 'calc(100vh - 260px)' }}>
                <Calendar
                    localizer={localizer}
                    events={events}
                    date={currentDate}
                    view={view}
                    onNavigate={setCurrentDate}
                    onView={(v) => setView(v as ViewType)}
                    components={calendarComponents}
                    views={{ month: true, week: true, day: true }}
                    popup
                    style={{ height: '100%' }}
                    eventPropGetter={(ev) => {
                        const st = ((ev.resource?.status || 'TO DO') as string).toUpperCase() as Status;
                        return {
                            style: {
                                backgroundColor: statusBg[st] ?? '#9e9e9e',
                                fontSize: '0.75rem',
                                lineHeight: 1.15,
                            },
                        };
                    }}
                    onSelectEvent={(ev) => {
                        const id = ev.resource?.id;
                        if (!id) return;
                        const t = items.find((x) => x._id === id);
                        if (t) setSelected(t);
                    }}
                />
            </Box>

            <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
                {selected && (
                    <>
                        <DialogTitle sx={{ fontSize: 16 }}>
                            {selected.taskName} {selected.bsNumber ? `| ${selected.bsNumber}` : ''}
                        </DialogTitle>

                        <DialogContent dividers>
                            <Stack direction="row" spacing={2} mb={2} flexWrap="wrap">
                                <Chip
                                    label={(selected.status || 'TO DO').toString().toUpperCase()}
                                    sx={{
                                        bgcolor:
                                            statusBg[((selected.status || 'TO DO') as string).toUpperCase() as Status] ??
                                            '#9e9e9e',
                                        color: '#fff',
                                    }}
                                />
                                {selected.priority && (
                                    <Chip
                                        label={selected.priority}
                                        sx={{
                                            bgcolor: prColors[(selected.priority as Priority) || 'medium'],
                                            color: '#fff',
                                        }}
                                    />
                                )}
                                {selected.createdAt && (
                                    <Typography variant="body2">
                                        Created: {new Date(selected.createdAt).toLocaleDateString('ru-RU')}
                                    </Typography>
                                )}
                                {selected.dueDate && (
                                    <Typography variant="body2">
                                        Due: {new Date(selected.dueDate).toLocaleDateString('ru-RU')}
                                    </Typography>
                                )}
                            </Stack>

                            <Stack spacing={1}>
                                {selected.bsNumber && (
                                    <Typography variant="subtitle2">BS Number: {selected.bsNumber}</Typography>
                                )}
                                {selected.bsAddress && (
                                    <Typography variant="subtitle2">Address: {selected.bsAddress}</Typography>
                                )}
                                {typeof selected.totalCost === 'number' && (
                                    <Typography variant="subtitle2">Cost: {selected.totalCost}</Typography>
                                )}
                            </Stack>
                        </DialogContent>

                        <DialogActions>
                            <Button onClick={() => setSelected(null)}>Close</Button>
                        </DialogActions>
                    </>
                )}
            </Dialog>
        </>
    );
}

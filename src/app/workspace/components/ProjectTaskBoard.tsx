'use client';

import React, { useMemo } from 'react';
import { Box, Typography, Card, CardContent, Chip } from '@mui/material';
import Tooltip from '@mui/material/Tooltip';
import TaskOutlinedIcon from '@mui/icons-material/TaskOutlined';
import { getStatusColor } from '@/utils/statusColors';

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

type Task = {
    _id: string;
    taskId: string;
    taskName: string;
    bsNumber?: string;
    createdAt?: string;
    dueDate?: string;
    status?: string; // нормализуем в Title Case
    priority?: 'urgent' | 'high' | 'medium' | 'low';
};

const prColor: Record<NonNullable<Task['priority']>, string> = {
    urgent: '#d32f2f',
    high: '#f57c00',
    medium: '#1976d2',
    low: '#388e3c',
};

const formatDateRU = (v?: string) => (v ? new Date(v).toLocaleDateString('ru-RU') : '—');

const TITLE_CASE_MAP: Record<string, StatusTitle> = {
    'TO DO': 'To do',
    'TODO': 'To do',
    'TO-DO': 'To do',
    'ASSIGNED': 'Assigned',
    'IN PROGRESS': 'At work',
    'IN-PROGRESS': 'At work',
    'AT WORK': 'At work',
    'DONE': 'Done',
    'PENDING': 'Pending',
    'ISSUES': 'Issues',
    'FIXED': 'Fixed',
    'AGREED': 'Agreed',
};

function normalizeStatusTitle(s?: string): StatusTitle {
    if (!s) return 'To do';
    const key = s.trim().toUpperCase();
    return TITLE_CASE_MAP[key] ?? (s as StatusTitle);
}

function TaskCard({ t, statusTitle }: { t: Task; statusTitle: StatusTitle }) {
    return (
        <Card sx={{ mb: 2, boxShadow: 2 }}>
            <Box sx={{ mt: '5px', ml: '5px' }}>
                <Typography variant="caption" color="text.secondary">
                    <TaskOutlinedIcon sx={{ fontSize: 15, mb: 0.5, mr: 0.5 }} />
                    {t.taskId} {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                </Typography>
            </Box>
            <CardContent>
                <Typography variant="subtitle1" gutterBottom>{t.taskName}</Typography>
                <Typography variant="body2">BS: {t.bsNumber || '—'}</Typography>
                <Typography variant="caption">Due date: {formatDateRU(t.dueDate)}</Typography>
            </CardContent>
            <Box sx={{ m: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Chip
                    label={statusTitle}
                    size="small"
                    sx={{ bgcolor: getStatusColor(statusTitle), color: '#fff' }}
                />
                {t.priority && (
                    <Tooltip title={t.priority}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: prColor[t.priority] }} />
                    </Tooltip>
                )}
            </Box>
        </Card>
    );
}

export default function ProjectTaskBoard({
                                             items,
                                             loading,
                                             error,
                                         }: {
    items: Task[];
    loading: boolean;
    error: string | null;
}) {
    const grouped = useMemo(() => {
        const base: Record<StatusTitle, Task[]> = {
            'To do': [],
            'Assigned': [],
            'At work': [],
            'Done': [],
            'Pending': [],
            'Issues': [],
            'Fixed': [],
            'Agreed': [],
        };
        for (const t of items) {
            const s = normalizeStatusTitle(t.status);
            base[s].push(t);
        }
        return base;
    }, [items]);

    if (loading)
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">Загрузка…</Typography>
            </Box>
        );
    if (error)
        return (
            <Box sx={{ p: 2 }}>
                <Typography color="error">{error}</Typography>
            </Box>
        );

    return (
        <Box>
            <Box sx={{ display: 'flex', gap: 3, p: 3, overflowX: 'auto', minHeight: '60vh' }}>
                {STATUS_ORDER.map((status) => (
                    <Box
                        key={status}
                        sx={{
                            minWidth: 260,
                            backgroundColor: 'background.paper',
                            p: 2,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                        }}
                    >
                        <Typography variant="h6" sx={{ mb: 2, textTransform: 'none' }}>
                            {status} ({grouped[status]?.length || 0})
                        </Typography>
                        {(grouped[status] || []).map((t) => (
                            <TaskCard key={t._id} t={t} statusTitle={status} />
                        ))}
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

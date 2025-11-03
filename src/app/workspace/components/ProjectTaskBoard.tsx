// src/app/workspace/components/ProjectTaskBoard.tsx
'use client';

import React, { useMemo } from 'react';
import { Box, Typography, Card, CardContent, Chip } from '@mui/material';
import Tooltip from '@mui/material/Tooltip';
import TaskOutlinedIcon from '@mui/icons-material/TaskOutlined';

type Task = {
    _id: string;
    taskId: string;
    taskName: string;
    bsNumber?: string;
    createdAt?: string;
    dueDate?: string;
    status?: string;
    priority?: 'urgent' | 'high' | 'medium' | 'low';
};

const statusOrder = ['TO DO', 'IN PROGRESS', 'DONE'] as const;

const statusChipColor: Record<string, string> = {
    'TO DO': '#9e9e9e',
    'IN PROGRESS': '#0288d1',
    DONE: '#2e7d32',
};

const prColor: Record<NonNullable<Task['priority']>, string> = {
    urgent: '#d32f2f',
    high: '#f57c00',
    medium: '#1976d2',
    low: '#388e3c',
};

const formatDateRU = (v?: string) => (v ? new Date(v).toLocaleDateString('ru-RU') : '—');

function TaskCard({ t }: { t: Task }) {
    return (
        <Card sx={{ mb: 2, boxShadow: 2 }}>
            <Box sx={{ mt: '5px', ml: '5px' }}>
                <Typography variant="caption" color="text.secondary">
                    <TaskOutlinedIcon sx={{ fontSize: 15, mb: 0.5, mr: 0.5 }} />
                    {t.taskId} {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : ''}
                </Typography>
            </Box>
            <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                    {t.taskName}
                </Typography>
                <Typography variant="body2">BS: {t.bsNumber || '—'}</Typography>
                <Typography variant="caption">Due date: {formatDateRU(t.dueDate)}</Typography>
            </CardContent>
            <Box sx={{ m: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Chip
                    label={t.status || 'TO DO'}
                    size="small"
                    sx={{ bgcolor: statusChipColor[t.status || 'TO DO'] ?? '#9e9e9e', color: '#fff' }}
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
        const m: Record<string, Task[]> = { 'TO DO': [], 'IN PROGRESS': [], DONE: [] };
        for (const t of items) {
            const s = (t.status || 'TO DO').toUpperCase();
            (m[s] || m['TO DO']).push(t);
        }
        return m;
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
                {statusOrder.map((status) => (
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
                            <TaskCard key={t._id} t={t} />
                        ))}
                    </Box>
                ))}
            </Box>
        </Box>
    );
}

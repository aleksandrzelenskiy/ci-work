// app/workspace/components/ProjectTaskBoard.tsx

'use client';

import React, { useMemo } from 'react';
import { Box, Typography, Card, CardContent, Chip } from '@mui/material';
import Tooltip from '@mui/material/Tooltip';
import TaskOutlinedIcon from '@mui/icons-material/TaskOutlined';
import { getStatusColor } from '@/utils/statusColors';
import { getPriorityIcon, normalizePriority } from '@/utils/priorityIcons';

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
    status?: string;
    priority?: 'urgent' | 'high' | 'medium' | 'low' | string;
    executorId?: string;
    executorName?: string;
    executorEmail?: string;
};

const formatDateRU = (v?: string) => (v ? new Date(v).toLocaleDateString('ru-RU') : '—');

const TITLE_CASE_MAP: Record<string, StatusTitle> = {
    'TO DO': 'To do',
    TODO: 'To do',
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

function TaskCard({ t, statusTitle }: { t: Task; statusTitle: StatusTitle }) {
    const p = normalizePriority(t.priority); // 'urgent' | 'high' | 'medium' | 'low' | null
    const execLabel = t.executorName || t.executorEmail || '';
    const execTooltip =
        t.executorName && t.executorEmail ? `${t.executorName} • ${t.executorEmail}` : execLabel;

    return (
        <Card sx={{ mb: 2, boxShadow: 2, position: 'relative', overflow: 'hidden' }}>
            <Box sx={{ mt: '5px', ml: '5px' }}>
                <Typography variant="caption" color="text.secondary">
                    <TaskOutlinedIcon sx={{ fontSize: 15, mb: 0.5, mr: 0.5 }} />
                    {t.taskId} {t.createdAt ? new Date(t.createdAt).toLocaleDateString('ru-RU') : ''}
                </Typography>
            </Box>

            <CardContent sx={{ pb: 6 /* оставляем место под нижнюю плашку */ }}>
                <Typography variant="subtitle1" gutterBottom>
                    {t.taskName}
                </Typography>

                <Typography variant="body2">BS: {t.bsNumber || '—'}</Typography>

                {/* Исполнитель (из executor*) */}
                <Box sx={{ mt: 0.5, minHeight: 28 }}>
                    {execLabel ? (
                        <Tooltip title={execTooltip}>
                            <Chip
                                size="small"
                                label={execLabel}
                                variant="outlined"
                                sx={{ maxWidth: '100%' }}
                            />
                        </Tooltip>
                    ) : (
                        <Typography variant="caption" color="text.secondary">
                            Исполнитель: —
                        </Typography>
                    )}
                </Box>

                <Typography variant="caption">Due date: {formatDateRU(t.dueDate)}</Typography>
            </CardContent>

            {/* Нижняя плашка: слева статус, справа — иконка приоритета с тултипом */}
            <Box
                sx={{
                    position: 'absolute',
                    left: 8,
                    right: 8,
                    bottom: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                }}
            >
                <Chip
                    label={statusTitle}
                    size="small"
                    sx={{ bgcolor: getStatusColor(statusTitle), color: '#fff' }}
                />

                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }}>
                    {p && (
                        <Tooltip title={p}>
                            <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                                {getPriorityIcon(p, { fontSize: 20 })}
                            </Box>
                        </Tooltip>
                    )}
                </Box>
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
            Assigned: [],
            'At work': [],
            Done: [],
            Pending: [],
            Issues: [],
            Fixed: [],
            Agreed: [],
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

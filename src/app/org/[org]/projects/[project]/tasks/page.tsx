// src/app/org/[org]/projects/[project]/tasks/page.tsx
'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import {
    Box,
    Stack,
    Typography,
    Button,
    Tabs,
    Tab,
    Paper,
    TextField,
    IconButton,
    Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';

import WorkspaceTaskDialog from '@/app/workspace/components/WorkspaceTaskDialog';
import ProjectTaskList from '@/app/workspace/components/ProjectTaskList';
import ProjectTaskBoard from '@/app/workspace/components/ProjectTaskBoard';
import ProjectTaskCalendar from '@/app/workspace/components/ProjectTaskCalendar';

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

type OrgInfo = { _id: string; name: string; orgSlug: string };

type ApiListResponse =
    | { ok: true; page: number; limit: number; total: number; items: Task[] }
    | { error: string };

export default function ProjectTasksPage() {
    const params = useParams<{ org: string; project: string }>() as {
        org: string;
        project: string;
    };
    const org = params.org;
    const project = params.project;

    const [tab, setTab] = React.useState<'list' | 'board' | 'calendar'>('list');
    const [open, setOpen] = React.useState(false);
    const [q, setQ] = React.useState('');
    const [loading, setLoading] = React.useState(true);
    const [items, setItems] = React.useState<Task[]>([]);
    const [error, setError] = React.useState<string | null>(null);

    // ─────────────── org info (чтобы показывать имя вместо slug) ───────────────
    const [orgInfo, setOrgInfo] = React.useState<OrgInfo | null>(null);
    const [orgInfoError, setOrgInfoError] = React.useState<string | null>(null);

    React.useEffect(() => {
        const ctrl = new AbortController();

        async function fetchOrg(): Promise<void> {
            try {
                setOrgInfoError(null);
                const res = await fetch(`/api/org/${org}`, {
                    signal: ctrl.signal,
                    cache: 'no-store',
                });

                const data = (await res.json().catch(() => null)) as
                    | { org: OrgInfo; role: string }
                    | { error: string }
                    | null;

                if (!res.ok || !data || 'error' in data) {
                    // не кидаем исключение — сразу фиксируем ошибку
                    setOrgInfoError(
                        !data || !('error' in data) ? `Failed to load org: ${res.status}` : data.error
                    );
                    setOrgInfo(null);
                    return;
                }

                setOrgInfo(data.org);
            } catch (e) {
                if ((e as DOMException)?.name !== 'AbortError') {
                    setOrgInfoError(e instanceof Error ? e.message : 'Org load error');
                }
            }
        }

        void fetchOrg(); // явный игнор промиса — для линтера
        return () => ctrl.abort();
    }, [org]);

    // ─────────────── загрузка задач ───────────────
    const load = React.useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const url = new URL(
                `/api/org/${org}/projects/${project}/tasks`,
                window.location.origin
            );
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
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 2 }}
            >
                <Box>
                    <Typography variant="h5" fontWeight={700}>
                        Задачи проекта
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Организация: {orgInfo?.name ?? org} · Проект: {project}
                    </Typography>
                    {orgInfoError && (
                        <Typography variant="caption" color="error">
                            Не удалось загрузить организацию: {orgInfoError}
                        </Typography>
                    )}
                </Box>
                <Stack direction="row" spacing={1}>
                    <Tooltip title="Обновить">
            <span>
              <IconButton onClick={() => void load()} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
                    </Tooltip>
                    <Button
                        onClick={() => setOpen(true)}
                        variant="contained"
                        startIcon={<AddIcon />}
                    >
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
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') void load();
                        }}
                        sx={{ width: 360, maxWidth: '100%' }}
                    />
                    <Button onClick={() => void load()} variant="outlined">
                        Искать
                    </Button>
                </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1, mb: 2 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
                    <Tab value="list" label="Список" />
                    <Tab value="board" label="Доска" />
                    <Tab value="calendar" label="Календарь" />
                </Tabs>

                {tab === 'list' && (
                    <ProjectTaskList items={items} loading={loading} error={error} />
                )}
                {tab === 'board' && (
                    <ProjectTaskBoard items={items} loading={loading} error={error} />
                )}
                {tab === 'calendar' && (
                    <ProjectTaskCalendar items={items} loading={loading} error={error} />
                )}

                <WorkspaceTaskDialog
                    open={open}
                    org={org}
                    project={project}
                    onCloseAction={() => setOpen(false)}
                    onCreatedAction={() => {
                        setOpen(false);
                        void load();
                    }}
                />
            </Paper>
        </Box>
    );
}

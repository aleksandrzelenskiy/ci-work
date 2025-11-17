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
    InputAdornment,
    Tooltip,
    Popover,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import DriveFileMoveOutlinedIcon from '@mui/icons-material/DriveFileMoveOutlined';

import WorkspaceTaskDialog from '@/app/workspace/components/WorkspaceTaskDialog';
import ProjectTaskList, { ProjectTaskListHandle } from '@/app/workspace/components/ProjectTaskList';
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

type OrgInfo = { _id: string; name: string; orgSlug: string; description?: string };

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

    const orgSlug = React.useMemo(() => org?.trim(), [org]);
    const projectRef = React.useMemo(() => project?.trim(), [project]);

    const [tab, setTab] = React.useState<'list' | 'board' | 'calendar'>('list');
    const [open, setOpen] = React.useState(false);
    const [q, setQ] = React.useState('');
    const [projectDescription, setProjectDescription] = React.useState<string | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [items, setItems] = React.useState<Task[]>([]);
    const [error, setError] = React.useState<string | null>(null);
    const [listFiltersVisible, setListFiltersVisible] = React.useState(false);
    const taskListRef = React.useRef<ProjectTaskListHandle>(null);
    const [searchAnchor, setSearchAnchor] = React.useState<HTMLElement | null>(null);

    const [orgInfo, setOrgInfo] = React.useState<OrgInfo | null>(null);
    const [orgInfoError, setOrgInfoError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!orgSlug) return;
        const ctrl = new AbortController();

        async function fetchOrg(): Promise<void> {
            try {
                setOrgInfoError(null);
                const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}`, {
                    signal: ctrl.signal,
                    cache: 'no-store',
                });

                const data = (await res.json().catch(() => null)) as
                    | { org: OrgInfo; role: string }
                    | { error: string }
                    | null;

                if (!res.ok || !data || 'error' in data) {
                    setOrgInfoError(
                        !data || !('error' in data)
                            ? `Failed to load org: ${res.status}`
                            : data.error
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

        void fetchOrg();
        return () => ctrl.abort();
    }, [orgSlug]);

    const load = React.useCallback(async () => {
        if (!orgSlug || !projectRef) return;
        try {
            setLoading(true);
            setError(null);
            const url = new URL(
                `/api/org/${encodeURIComponent(orgSlug)}/projects/${encodeURIComponent(
                    projectRef
                )}/tasks`,
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
    }, [orgSlug, projectRef, q]);

React.useEffect(() => {
    void load();
}, [load]);

    React.useEffect(() => {
        if (!orgSlug || !projectRef) return;
        let cancelled = false;

        void (async () => {
            try {
                const res = await fetch(
                    `/api/org/${encodeURIComponent(orgSlug)}/projects/${encodeURIComponent(
                        projectRef
                    )}`,
                    { cache: 'no-store' }
                );
                if (!res.ok) return;
                const data = (await res.json().catch(() => null)) as
                    | { ok: true; project: { description?: string } }
                    | { error: string }
                    | null;
                if (!data || 'error' in data) return;
                if (!cancelled) {
                    setProjectDescription(data.project.description ?? null);
                }
            } catch {
                // описание опционально, ошибки игнорируем
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [orgSlug, projectRef]);

    const handleSearchIconClick = (event: React.MouseEvent<HTMLElement>) => {
        if (searchAnchor && event.currentTarget === searchAnchor) {
            setSearchAnchor(null);
            return;
        }
        setSearchAnchor(event.currentTarget);
    };

    const handleSearchClose = () => {
        setSearchAnchor(null);
    };

    const handleSearchReset = () => {
        setQ('');
        handleSearchClose();
        void load();
    };

    const searchOpen = Boolean(searchAnchor);

    return (
        <Box sx={{ p: 2 }}>
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                justifyContent="space-between"
                sx={{ mb: 2 }}
            >
                <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Tooltip title="К списку проектов">
                            <span>
                                <IconButton
                                    component="a"
                                    href={
                                        orgSlug
                                            ? `/org/${encodeURIComponent(orgSlug)}/projects`
                                            : '#'
                                    }
                                    disabled={!orgSlug}
                                    size="small"
                                    aria-label="Перейти к проектам"
                                >
                                    <DriveFileMoveOutlinedIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Typography variant="h5" fontWeight={700}>
                            Задачи проекта {projectRef}
                        </Typography>
                    </Stack>
                    <Typography variant="body1" color="text.secondary">
                        Организация: {orgInfo?.name ?? orgSlug}
                    </Typography>
                    {projectDescription && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {projectDescription}
                        </Typography>
                    )}
                    {orgInfoError && (
                        <Typography variant="caption" color="error">
                            Не удалось загрузить организацию: {orgInfoError}
                        </Typography>
                    )}
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title="Поиск">
                        <IconButton
                            color={searchOpen || q ? 'primary' : 'default'}
                            onClick={handleSearchIconClick}
                        >
                            <SearchIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip
                        title={
                            tab === 'list'
                                ? listFiltersVisible
                                    ? 'Скрыть фильтры'
                                    : 'Показать фильтры'
                                : 'Фильтры доступны только в списке'
                        }
                    >
                        <span>
                            <IconButton
                                color={listFiltersVisible ? 'primary' : 'default'}
                                disabled={tab !== 'list'}
                                onClick={() => taskListRef.current?.toggleFilters()}
                            >
                                <FilterListIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    {tab === 'list' && (
                        <Tooltip title="Настроить колонки">
                            <IconButton
                                onClick={(e) => taskListRef.current?.openColumns(e.currentTarget)}
                            >
                                <ViewColumnOutlinedIcon />
                            </IconButton>
                        </Tooltip>
                    )}
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

            <Popover
                open={searchOpen}
                anchorEl={searchAnchor}
                onClose={handleSearchClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            >
                <Box sx={{ p: 2, width: 320 }}>
                    <TextField
                        label="Поиск (ID, название, БС)"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                handleSearchClose();
                            }
                        }}
                        autoFocus
                        fullWidth
                        InputProps={{
                            endAdornment: q ? (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={handleSearchReset} edge="end">
                                        <CloseIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                        }}
                    />
                </Box>
            </Popover>

            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v as 'list' | 'board' | 'calendar')}
                    sx={{ mb: 2 }}
                    variant="scrollable"
                    scrollButtons="auto"
                >
                    <Tab value="list" label="Список" />
                    <Tab value="board" label="Доска" />
                    <Tab value="calendar" label="Календарь" />
                </Tabs>

                {tab === 'list' && (
                    <ProjectTaskList
                        ref={taskListRef}
                        items={items}
                        loading={loading}
                        error={error}
                        org={orgSlug || ''}
                        project={projectRef || ''}
                        onReloadAction={() => {
                            void load();
                        }}
                        onFilterToggleChange={setListFiltersVisible}
                    />
                )}

                {tab === 'board' && (
                    <ProjectTaskBoard
                        items={items}
                        loading={loading}
                        error={error}
                        org={orgSlug || ''}
                        project={projectRef || ''}
                        onReloadAction={() => {
                            void load();
                        }}
                    />
                )}

                {tab === 'calendar' && (
                    <ProjectTaskCalendar
                        items={items}
                        loading={loading}
                        error={error}
                        org={orgSlug || ''}
                        project={projectRef || ''}
                        onReloadAction={() => {
                            void load();
                        }}
                    />
                )}

                <WorkspaceTaskDialog
                    open={open}
                    org={orgSlug || ''}
                    project={projectRef || ''}
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

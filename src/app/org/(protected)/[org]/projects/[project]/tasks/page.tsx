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
import { useTheme } from '@mui/material/styles';
import AddTaskIcon from '@mui/icons-material/AddTask';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import DriveFileMoveRtlOutlinedIcon from '@mui/icons-material/DriveFileMoveRtlOutlined';

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
type OrgRole = 'owner' | 'org_admin' | 'manager' | 'executor' | 'viewer';
type MemberDTO = {
    userEmail: string;
    userName?: string;
    role: OrgRole;
    status: 'active' | 'invited';
};
type MembersResponse = { members: MemberDTO[] } | { error: string };

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
    const [projectManagers, setProjectManagers] = React.useState<string[]>([]);
    const [membersByEmail, setMembersByEmail] = React.useState<Record<string, MemberDTO>>({});
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
    const headerBg = isDarkMode ? 'rgba(17,22,33,0.85)' : 'rgba(255,255,255,0.55)';
    const headerBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)';
    const headerShadow = isDarkMode ? '0 25px 70px rgba(0,0,0,0.55)' : '0 25px 80px rgba(15,23,42,0.1)';
    const sectionBg = isDarkMode ? 'rgba(18,24,36,0.85)' : 'rgba(255,255,255,0.65)';
    const sectionBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)';
    const sectionShadow = isDarkMode ? '0 35px 90px rgba(0,0,0,0.5)' : '0 35px 90px rgba(15,23,42,0.15)';
    const textPrimary = isDarkMode ? '#f8fafc' : '#0f172a';
    const textSecondary = isDarkMode ? 'rgba(226,232,240,0.8)' : 'rgba(15,23,42,0.7)';
    const iconBorderColor = isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.12)';
    const iconBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)';
    const iconHoverBg = isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.9)';
    const iconShadow = isDarkMode ? '0 6px 18px rgba(0,0,0,0.4)' : '0 6px 18px rgba(15,23,42,0.08)';
    const iconText = textPrimary;
    const iconActiveBg = isDarkMode ? 'rgba(59,130,246,0.4)' : 'rgba(15,23,42,0.9)';
    const iconActiveText = '#ffffff';
    const disabledIconColor = isDarkMode ? 'rgba(148,163,184,0.7)' : 'rgba(15,23,42,0.35)';
    const tabActiveBg = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)';
    const tabInactiveColor = isDarkMode ? 'rgba(226,232,240,0.65)' : 'rgba(15,23,42,0.55)';
    const tabBorderColor = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)';
    const buttonShadow = isDarkMode ? '0 25px 45px rgba(0,0,0,0.55)' : '0 20px 45px rgba(15,23,42,0.18)';

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
                    setProjectManagers(Array.isArray(data.project.managers) ? data.project.managers : []);
                }
            } catch {
                // описание опционально, ошибки игнорируем
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [orgSlug, projectRef]);

    React.useEffect(() => {
        if (!orgSlug) return;
        const ctrl = new AbortController();
        let cancelled = false;

        void (async () => {
            try {
                const res = await fetch(
                    `/api/org/${encodeURIComponent(orgSlug)}/members?status=active`,
                    { cache: 'no-store', signal: ctrl.signal }
                );
                const data: MembersResponse = await res.json();
                if (!res.ok || !('members' in data) || cancelled) {
                    if (!cancelled) {
                        console.error(
                            'Failed to load members',
                            'error' in data ? data.error : `status: ${res.status}`
                        );
                        setMembersByEmail({});
                    }
                    return;
                }

                const record: Record<string, MemberDTO> = {};
                for (const member of data.members) {
                    if (member.userEmail) {
                        record[member.userEmail.toLowerCase()] = member;
                    }
                }
                if (!cancelled) {
                    setMembersByEmail(record);
                }
            } catch (e) {
                if ((e as DOMException)?.name === 'AbortError' || cancelled) return;
                console.error('Failed to load members', e);
                setMembersByEmail({});
            }
        })();

        return () => {
            cancelled = true;
            ctrl.abort();
        };
    }, [orgSlug]);

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
    const getIconButtonSx = (options?: { active?: boolean; disabled?: boolean }) => {
        const active = options?.active ?? false;
        const disabled = options?.disabled ?? false;
        return {
            borderRadius: '16px',
            border: `1px solid ${disabled ? 'transparent' : iconBorderColor}`,
            backgroundColor: disabled
                ? 'transparent'
                : active
                ? iconActiveBg
                : iconBg,
            color: disabled ? disabledIconColor : active ? iconActiveText : iconText,
            boxShadow: disabled ? 'none' : iconShadow,
            backdropFilter: 'blur(14px)',
            transition: 'all 0.2s ease',
            '&:hover': {
                transform: disabled ? 'none' : 'translateY(-2px)',
                backgroundColor: disabled
                    ? 'transparent'
                    : active
                    ? iconActiveBg
                    : iconHoverBg,
            },
        };
    };

    React.useEffect(() => {
        if (tab !== 'list' && listFiltersVisible) {
            setListFiltersVisible(false);
        }
    }, [tab, listFiltersVisible]);

    const primaryManagerRaw = React.useMemo(() => {
        const first = projectManagers.find((manager) => manager.trim().length > 0);
        return first?.trim() ?? null;
    }, [projectManagers]);

    const managerDisplayName = React.useMemo(() => {
        if (!primaryManagerRaw) return null;
        const normalized = primaryManagerRaw.toLowerCase();
        const member = membersByEmail[normalized];
        if (member?.userName) return member.userName;
        if (member?.userEmail) return member.userEmail;
        return primaryManagerRaw;
    }, [primaryManagerRaw, membersByEmail]);

    return (
        <Box
            sx={{
                minHeight: '100%',
                py: { xs: 4, md: 6 },
                px: { xs: 2, md: 6 },
            }}
        >
            <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%' }}>
                <Box
                    sx={{
                        mb: 3,
                        borderRadius: 4,
                        p: { xs: 2, md: 3 },
                        backgroundColor: headerBg,
                        border: `1px solid ${headerBorder}`,
                        boxShadow: headerShadow,
                        backdropFilter: 'blur(22px)',
                    }}
                >
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        justifyContent="space-between"
                    >
                        <Box>
                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
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
                                            aria-label="Перейти к проектам"
                                            sx={getIconButtonSx({ disabled: !orgSlug })}
                                        >
                                            <DriveFileMoveRtlOutlinedIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <Typography
                                    variant="h5"
                                    fontWeight={700}
                                    color={textPrimary}
                                    sx={{ fontSize: { xs: '1.6rem', md: '1.95rem' } }}
                                >
                                    Задачи {projectRef}
                                </Typography>
                            </Stack>
                            <Typography
                                variant="body1"
                                color={textSecondary}
                                sx={{ fontSize: { xs: '1rem', md: '1.05rem' } }}
                            >
                                Организация: {orgInfo?.name ?? orgSlug}
                            </Typography>
                            {managerDisplayName && (
                                <Typography
                                    variant="body1"
                                    color={textSecondary}
                                    sx={{ fontSize: { xs: '1rem', md: '1.05rem' }, mt: 0.5 }}
                                >
                                    Менеджер проекта:{' '}
                                    <Box component="span" sx={{ color: textPrimary, fontWeight: 600 }}>
                                        {managerDisplayName}
                                    </Box>
                                </Typography>
                            )}
                            {projectDescription && (
                                <Typography variant="body2" color={textSecondary} sx={{ mt: 0.5 }}>
                                    {projectDescription}
                                </Typography>
                            )}
                            {orgInfoError && (
                                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                                    Не удалось загрузить организацию: {orgInfoError}
                                </Typography>
                            )}
                        </Box>
                        <Stack
                            direction="row"
                            spacing={1.25}
                            alignItems="center"
                            sx={{ flexWrap: 'wrap', rowGap: 1 }}
                        >
                            <Tooltip title="Поиск">
                                <IconButton
                                    onClick={handleSearchIconClick}
                                    sx={getIconButtonSx({ active: searchOpen || Boolean(q) })}
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
                                        disabled={tab !== 'list'}
                                        onClick={() => taskListRef.current?.toggleFilters()}
                                        sx={getIconButtonSx({
                                            disabled: tab !== 'list',
                                            active: listFiltersVisible,
                                        })}
                                    >
                                        <FilterListIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            {tab === 'list' && (
                                <Tooltip title="Настроить колонки">
                                    <IconButton
                                        onClick={(event) =>
                                            taskListRef.current?.openColumns(event.currentTarget)
                                        }
                                        sx={getIconButtonSx()}
                                    >
                                        <ViewColumnOutlinedIcon />
                                    </IconButton>
                                </Tooltip>
                            )}
                            <Tooltip title="Обновить">
                                <span>
                                    <IconButton
                                        onClick={() => void load()}
                                        disabled={loading}
                                        sx={getIconButtonSx({ disabled: loading })}
                                    >
                                        <RefreshIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            <Button
                                onClick={() => setOpen(true)}
                                variant="contained"
                                startIcon={<AddTaskIcon />}
                                sx={{
                                    borderRadius: 999,
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    px: { xs: 2.5, md: 3 },
                                    py: 1,
                                    boxShadow: buttonShadow,
                                }}
                            >
                                Создать задачу
                            </Button>
                        </Stack>
                    </Stack>
                </Box>

                <Popover
                    open={searchOpen}
                    anchorEl={searchAnchor}
                    onClose={handleSearchClose}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    PaperProps={{
                        sx: {
                            borderRadius: 3,
                            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.65)'}`,
                            backgroundColor: isDarkMode
                                ? 'rgba(15,18,28,0.95)'
                                : 'rgba(255,255,255,0.9)',
                            boxShadow: isDarkMode
                                ? '0 25px 70px rgba(0,0,0,0.6)'
                                : '0 25px 70px rgba(15,23,42,0.15)',
                            backdropFilter: 'blur(18px)',
                        },
                    }}
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
                                        <IconButton
                                            size="small"
                                            onClick={handleSearchReset}
                                            edge="end"
                                        >
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </InputAdornment>
                                ) : null,
                            }}
                        />
                    </Box>
                </Popover>

                <Paper
                    variant="outlined"
                    sx={{
                        p: { xs: 2, md: 3 },
                        borderRadius: 4,
                        border: `1px solid ${sectionBorder}`,
                        backgroundColor: sectionBg,
                        boxShadow: sectionShadow,
                        backdropFilter: 'blur(18px)',
                    }}
                >
                    <Tabs
                        value={tab}
                        onChange={(_, v) => setTab(v as 'list' | 'board' | 'calendar')}
                        sx={{
                            minHeight: 0,
                            mb: 2.5,
                            borderRadius: 3,
                            border: `1px solid ${tabBorderColor}`,
                            backgroundColor: isDarkMode ? 'rgba(15,18,28,0.65)' : 'rgba(255,255,255,0.7)',
                            '& .MuiTabs-indicator': {
                                display: 'none',
                            },
                        }}
                        variant="scrollable"
                        scrollButtons="auto"
                    >
                        <Tab
                            value="list"
                            label="Список"
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: { xs: '0.9rem', md: '1rem' },
                                borderRadius: 3,
                                px: { xs: 1.5, md: 2.5 },
                                py: 1,
                                minHeight: 0,
                                minWidth: 0,
                                color: tabInactiveColor,
                                '&.Mui-selected': {
                                    backgroundColor: tabActiveBg,
                                    color: textPrimary,
                                    boxShadow: iconShadow,
                                },
                            }}
                        />
                        <Tab
                            value="board"
                            label="Доска"
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: { xs: '0.9rem', md: '1rem' },
                                borderRadius: 3,
                                px: { xs: 1.5, md: 2.5 },
                                py: 1,
                                minHeight: 0,
                                minWidth: 0,
                                color: tabInactiveColor,
                                '&.Mui-selected': {
                                    backgroundColor: tabActiveBg,
                                    color: textPrimary,
                                    boxShadow: iconShadow,
                                },
                            }}
                        />
                        <Tab
                            value="calendar"
                            label="Календарь"
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                fontSize: { xs: '0.9rem', md: '1rem' },
                                borderRadius: 3,
                                px: { xs: 1.5, md: 2.5 },
                                py: 1,
                                minHeight: 0,
                                minWidth: 0,
                                color: tabInactiveColor,
                                '&.Mui-selected': {
                                    backgroundColor: tabActiveBg,
                                    color: textPrimary,
                                    boxShadow: iconShadow,
                                },
                            }}
                        />
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
        </Box>
    );
}

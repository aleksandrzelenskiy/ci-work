// app/tasks/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback, MouseEvent } from 'react';
import {
    Alert,
    Box,
    CircularProgress,
    Paper,
    Typography,
    Tabs,
    Tab,
    Stack,
    TextField,
    IconButton,
    Tooltip,
    Popover,
    InputAdornment,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import CloseIcon from '@mui/icons-material/Close';

import TaskListPage, { TaskListPageHandle } from '../components/TaskListPage';
import TaskColumnPage from '../components/TaskColumnPage';
import { fetchUserContext, resolveRoleFromContext } from '@/app/utils/userContext';
import type { EffectiveOrgRole } from '@/app/types/roles';

type ViewMode = 'table' | 'kanban';

export default function TasksPage() {
    const [tab, setTab] = useState<ViewMode>('table');
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshToken, setRefreshToken] = useState(0);
    const [searchAnchor, setSearchAnchor] = useState<HTMLElement | null>(null);
    const taskListRef = useRef<TaskListPageHandle>(null);
    const [listFiltersVisible, setListFiltersVisible] = useState(false);
    const [userRole, setUserRole] = useState<EffectiveOrgRole | null>(null);
    const [roleLoading, setRoleLoading] = useState(true);
    const [roleError, setRoleError] = useState<string | null>(null);

    const searchOpen = Boolean(searchAnchor);
    const isExecutor = userRole === 'executor';
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

    useEffect(() => {
        let active = true;
        setRoleLoading(true);
        setRoleError(null);

        (async () => {
            try {
                const context = await fetchUserContext();
                if (!active) return;

                if (!context) {
                    setRoleError('Не удалось загрузить данные пользователя');
                    setUserRole(null);
                    return;
                }

                const resolvedRole = resolveRoleFromContext(context);
                if (!resolvedRole) {
                    setRoleError('Не удалось определить роль пользователя');
                    setUserRole(null);
                    return;
                }

                setUserRole(resolvedRole);
            } catch (err) {
                if (!active) return;
                console.error('Error loading user context', err);
                setRoleError('Не удалось загрузить данные пользователя');
                setUserRole(null);
            } finally {
                if (active) {
                    setRoleLoading(false);
                }
            }
        })();

        return () => {
            active = false;
        };
    }, []);

    const handleSearchIconClick = (event: MouseEvent<HTMLElement>) => {
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
        setSearchQuery('');
        handleSearchClose();
    };

    const handleFilterToggle = useCallback(() => {
        if (tab !== 'table') return;
        taskListRef.current?.toggleFilters();
    }, [tab]);

    const handleColumnsClick = useCallback(
        (event: MouseEvent<HTMLElement>) => {
            if (tab !== 'table') return;
            taskListRef.current?.openColumns(event.currentTarget);
        },
        [tab]
    );

    useEffect(() => {
        if (tab !== 'table' && listFiltersVisible) {
            setListFiltersVisible(false);
        }
    }, [tab, listFiltersVisible]);

    if (roleLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (roleError) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">{roleError}</Alert>
            </Box>
        );
    }

    if (!isExecutor) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="info">
                    Модуль «Мои задачи» доступен только исполнителям. Попросите менеджера
                    назначить вас исполнителем в организации, чтобы получить доступ к своим
                    назначениям.
                </Alert>
            </Box>
        );
    }

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
                            <Typography
                                variant="h5"
                                fontWeight={700}
                                color={textPrimary}
                                sx={{ fontSize: { xs: '1.6rem', md: '1.95rem' } }}
                            >
                                Мои задачи
                            </Typography>
                            <Typography
                                variant="body2"
                                color={textSecondary}
                                sx={{ fontSize: { xs: '0.95rem', md: '1.05rem' }, mt: 0.5 }}
                            >
                                Все задачи. Воспользуйтесь поиском или фильтрами
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Tooltip title="Поиск">
                                <IconButton
                                    onClick={handleSearchIconClick}
                                    sx={{
                                        borderRadius: '16px',
                                        border: `1px solid ${iconBorderColor}`,
                                        backgroundColor: searchOpen || searchQuery ? iconActiveBg : iconBg,
                                        color: searchOpen || searchQuery ? iconActiveText : iconText,
                                        boxShadow: iconShadow,
                                        backdropFilter: 'blur(14px)',
                                        transition: 'all 0.2s ease',
                                        '&:hover': {
                                            transform: 'translateY(-2px)',
                                            backgroundColor: searchOpen || searchQuery ? iconActiveBg : iconHoverBg,
                                        },
                                    }}
                                >
                                    <SearchIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip
                                title={
                                    tab === 'table'
                                        ? listFiltersVisible
                                            ? 'Скрыть фильтры'
                                            : 'Показать фильтры'
                                        : 'Фильтры доступны только в списке'
                                }
                            >
                                <span>
                                    <IconButton
                                        disabled={tab !== 'table'}
                                        onClick={handleFilterToggle}
                                        sx={{
                                            borderRadius: '16px',
                                            border: `1px solid ${tab !== 'table' ? 'transparent' : iconBorderColor}`,
                                            color:
                                                tab !== 'table'
                                                    ? disabledIconColor
                                                    : listFiltersVisible
                                                    ? iconActiveText
                                                    : iconText,
                                            backgroundColor:
                                                tab !== 'table'
                                                    ? 'transparent'
                                                    : listFiltersVisible
                                                    ? iconActiveBg
                                                    : iconBg,
                                            boxShadow: tab !== 'table' ? 'none' : iconShadow,
                                            backdropFilter: 'blur(14px)',
                                            transition: 'all 0.2s ease',
                                            '&:hover': {
                                                transform: tab !== 'table' ? 'none' : 'translateY(-2px)',
                                                backgroundColor:
                                                    tab !== 'table'
                                                        ? 'transparent'
                                                        : listFiltersVisible
                                                        ? iconActiveBg
                                                        : iconHoverBg,
                                            },
                                        }}
                                    >
                                        <FilterListIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                            {tab === 'table' && (
                                <Tooltip title="Настроить колонки">
                                    <IconButton
                                        onClick={handleColumnsClick}
                                        sx={{
                                            borderRadius: '16px',
                                            border: `1px solid ${iconBorderColor}`,
                                            backgroundColor: iconBg,
                                            color: iconText,
                                            boxShadow: iconShadow,
                                            backdropFilter: 'blur(14px)',
                                            transition: 'all 0.2s ease',
                                            '&:hover': {
                                                transform: 'translateY(-2px)',
                                                backgroundColor: iconHoverBg,
                                            },
                                        }}
                                    >
                                        <ViewColumnOutlinedIcon />
                                    </IconButton>
                                </Tooltip>
                            )}
                            <Tooltip title="Обновить">
                                <span>
                                    <IconButton
                                        onClick={() => setRefreshToken((prev) => prev + 1)}
                                        disabled={false}
                                        sx={{
                                            borderRadius: '16px',
                                            border: `1px solid ${iconBorderColor}`,
                                            backgroundColor: iconBg,
                                            color: iconText,
                                            boxShadow: iconShadow,
                                            backdropFilter: 'blur(14px)',
                                            transition: 'all 0.2s ease',
                                            '&:hover': {
                                                transform: 'translateY(-2px)',
                                                backgroundColor: iconHoverBg,
                                            },
                                        }}
                                    >
                                        <RefreshIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
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
                        backgroundColor: isDarkMode ? 'rgba(15,18,28,0.95)' : 'rgba(255,255,255,0.9)',
                        boxShadow: isDarkMode ? '0 25px 70px rgba(0,0,0,0.6)' : '0 25px 70px rgba(15,23,42,0.15)',
                        backdropFilter: 'blur(18px)',
                    },
                }}
            >
                <Box sx={{ p: 2, width: 320 }}>
                    <TextField
                        label="Поиск (ID, название, БС)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                handleSearchClose();
                            }
                        }}
                        autoFocus
                        fullWidth
                        InputProps={{
                            endAdornment: searchQuery ? (
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
                        onChange={(_, newValue) => setTab(newValue as ViewMode)}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{
                            minHeight: 0,
                            mb: 2,
                            '& .MuiTabs-indicator': {
                                display: 'none',
                            },
                        }}
                    >
                        <Tab
                            value="table"
                            label="СПИСОК"
                            sx={{
                                textTransform: 'uppercase',
                                fontWeight: 600,
                                borderRadius: '10px',
                                minHeight: 0,
                                px: 2.5,
                                py: 1.2,
                                mx: 0.5,
                                color: tab === 'table' ? textPrimary : tabInactiveColor,
                                backgroundColor: tab === 'table' ? tabActiveBg : 'transparent',
                                border: `1px solid ${tabBorderColor}`,
                                boxShadow:
                                    tab === 'table'
                                        ? iconShadow
                                        : 'none',
                            }}
                        />
                        <Tab
                            value="kanban"
                            label="ДОСКА"
                            sx={{
                                textTransform: 'uppercase',
                                fontWeight: 600,
                                borderRadius: '10px',
                                minHeight: 0,
                                px: 2.5,
                                py: 1.2,
                                mx: 0.5,
                                color: tab === 'kanban' ? textPrimary : tabInactiveColor,
                                backgroundColor: tab === 'kanban' ? tabActiveBg : 'transparent',
                                border: `1px solid ${tabBorderColor}`,
                                boxShadow:
                                    tab === 'kanban'
                                        ? iconShadow
                                        : 'none',
                            }}
                        />
                    </Tabs>

                    {tab === 'table' && (
                        <TaskListPage
                            ref={taskListRef}
                            searchQuery={searchQuery}
                            refreshToken={refreshToken}
                            hideToolbarControls
                            onFilterToggleChange={setListFiltersVisible}
                        />
                    )}
                    {tab === 'kanban' && (
                        <TaskColumnPage
                            searchQuery={searchQuery}
                            refreshToken={refreshToken}
                        />
                    )}
                </Paper>
            </Box>
        </Box>
    );
}

// app/tasks/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback, MouseEvent } from 'react';
import {
    Box,
    Paper,
    Typography,
    Tabs,
    Tab,
    Stack,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    IconButton,
    Tooltip,
    Popover,
    InputAdornment,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import CloseIcon from '@mui/icons-material/Close';

import TaskListPage, { TaskListPageHandle } from '../components/TaskListPage';
import TaskColumnPage from '../components/TaskColumnPage';

type ViewMode = 'table' | 'kanban';

export default function TasksPage() {
    const [tab, setTab] = useState<ViewMode>('table');
    const [searchQuery, setSearchQuery] = useState('');
    const [projectFilter, setProjectFilter] = useState('');
    const [projectOptions, setProjectOptions] = useState<string[]>([]);
    const [refreshToken, setRefreshToken] = useState(0);
    const [searchAnchor, setSearchAnchor] = useState<HTMLElement | null>(null);
    const taskListRef = useRef<TaskListPageHandle>(null);
    const [listFiltersVisible, setListFiltersVisible] = useState(false);

    const searchOpen = Boolean(searchAnchor);

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
        (async () => {
            try {
                const res = await fetch('/api/tasks');
                const data = await res.json();
                const tasks = Array.isArray(data.tasks) ? (data.tasks as Array<{ projectKey?: string | null }>) : [];
                if (tasks.length > 0) {
                    const unique = Array.from(
                        new Set(
                            tasks
                                .map((task) => task.projectKey?.trim())
                                .filter((key): key is string => Boolean(key))
                        )
                    );
                    setProjectOptions(unique);
                } else {
                    setProjectOptions([]);
                }
            } catch (err) {
                console.error('Error fetching project list', err);
            }
        })();
    }, [refreshToken]);
    useEffect(() => {
        if (projectFilter && projectOptions.length && !projectOptions.includes(projectFilter)) {
            setProjectFilter('');
        }
    }, [projectOptions, projectFilter]);

    useEffect(() => {
        if (tab !== 'table' && listFiltersVisible) {
            setListFiltersVisible(false);
        }
    }, [tab, listFiltersVisible]);

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
                    <Typography variant="h5" fontWeight={700}>
                        Все задачи
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {projectFilter ? `Проект: ${projectFilter}` : 'Агрегация задач из всех проектов'}
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title="Поиск">
                        <IconButton
                            color={searchOpen || searchQuery ? 'primary' : 'default'}
                            onClick={handleSearchIconClick}
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
                                color={listFiltersVisible ? 'primary' : 'default'}
                                disabled={tab !== 'table'}
                                onClick={handleFilterToggle}
                            >
                                <FilterListIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    {tab === 'table' && (
                        <Tooltip title="Настроить колонки">
                            <IconButton onClick={handleColumnsClick}>
                                <ViewColumnOutlinedIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Tooltip title="Обновить">
                        <span>
                            <IconButton
                                onClick={() => setRefreshToken((prev) => prev + 1)}
                                disabled={false}
                            >
                                <RefreshIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
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

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'stretch', md: 'center' }}
                    sx={{ mb: 2 }}
                >
                    <FormControl sx={{ minWidth: 200 }}>
                        <InputLabel>Проект</InputLabel>
                        <Select
                            label="Проект"
                            value={projectFilter}
                            onChange={(e) => setProjectFilter(e.target.value)}
                        >
                            <MenuItem value="">
                                <em>Все проекты</em>
                            </MenuItem>
                            {projectOptions.map((option) => (
                                <MenuItem key={option} value={option}>
                                    {option}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>
                <Tabs
                    value={tab}
                    onChange={(_, newValue) => setTab(newValue as ViewMode)}
                    variant="scrollable"
                    scrollButtons="auto"
                >
                    <Tab value="table" label="Список" />
                    <Tab value="kanban" label="Доска" />
                </Tabs>

                {tab === 'table' && (
                    <TaskListPage
                        ref={taskListRef}
                        searchQuery={searchQuery}
                        projectFilter={projectFilter}
                        refreshToken={refreshToken}
                        hideToolbarControls
                        onFilterToggleChange={setListFiltersVisible}
                    />
                )}
                {tab === 'kanban' && (
                    <TaskColumnPage
                        searchQuery={searchQuery}
                        projectFilter={projectFilter}
                        refreshToken={refreshToken}
                    />
                )}
            </Paper>
        </Box>
    );
}

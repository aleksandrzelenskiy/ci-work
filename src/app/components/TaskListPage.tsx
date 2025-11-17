// app/components/TaskListPage.tsx

'use client';

import React, { useState, useEffect, useMemo, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Avatar,
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  CircularProgress,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Button,
  Popover,
  Tooltip,
  Chip,
  Checkbox,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Stack,
  TextField,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { SingleInputDateRangeField } from '@mui/x-date-pickers-pro/SingleInputDateRangeField';
import { DateRange } from '@mui/x-date-pickers-pro/models';
import Pagination from '@mui/material/Pagination';
import {
  ViewColumn as ViewColumnIcon,
  FilterList as FilterListIcon,
  FilterAlt as FilterAltIcon,
} from '@mui/icons-material';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Task } from '../types/taskTypes';
import { getStatusColor } from '@/utils/statusColors';
import { useRouter } from 'next/navigation';
import { getPriorityIcon, getPriorityLabelRu } from '@/utils/priorityIcons';

interface TaskListPageProps {
  searchQuery?: string;
  projectFilter?: string;
  refreshToken?: number;
  hideToolbarControls?: boolean;
  onFilterToggleChange?: (visible: boolean) => void;
}

export interface TaskListPageHandle {
  toggleFilters: () => void;
  openColumns: (anchor: HTMLElement) => void;
  closeColumns: () => void;
  showFilters: boolean;
}

/* ───────────── формат даты dd.mm.yyyy ───────────── */
const formatDateRU = (value?: Date | string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU'); // dd.mm.yyyy
};

const STATUS_LABELS: Record<string, string> = {
  'To do': 'К выполнению',
  Assigned: 'Назначена',
  'At work': 'В работе',
  Pending: 'На проверке',
  Issues: 'Есть замечания',
  Done: 'Выполнено',
  Agreed: 'Согласовано',
  Cancelled: 'Отменено',
};

const getStatusLabel = (status: string) => STATUS_LABELS[status] ?? status;

const DEFAULT_COLUMN_VISIBILITY = {
  taskId: true,
  task: true,
  project: true,
  author: true,
  created: true,
  due: true,
  complete: true,
  status: true,
  priority: true,
} as const;

type ColumnKey = keyof typeof DEFAULT_COLUMN_VISIBILITY;

const COLUMN_LABELS: Record<ColumnKey, string> = {
  taskId: 'ID',
  task: 'Задача',
  project: 'Проект',
  author: 'Менеджер',
  created: 'Создана',
  due: 'Срок',
  complete: 'Завершено',
  status: 'Статус',
  priority: 'Приоритет',
};

const COLUMN_KEYS = Object.keys(DEFAULT_COLUMN_VISIBILITY) as ColumnKey[];

const getInitials = (value?: string) => {
  if (!value) return '—';
  return value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('') || '—';
};


/* ───────────── строка задачи ───────────── */
function Row({
  task,
  columnVisibility,
}: {
  task: Task;
  columnVisibility: Record<ColumnKey, boolean>;
}) {
  const router = useRouter();

  const buildUserInfo = (name?: string, email?: string) => {
    const trimmedName = name?.trim() ?? '';
    const trimmedEmail = email?.trim() ?? '';
    const primary = trimmedName || trimmedEmail || '—';
    const secondary =
      trimmedEmail && trimmedEmail.toLowerCase() !== primary.toLowerCase()
        ? trimmedEmail
        : '';
    const initials = getInitials(trimmedName || trimmedEmail);
    return { primary, secondary, initials };
  };

  const handleRowClick = () => {
    const slug = task.taskId ? task.taskId.toLowerCase() : task._id;
    if (slug) {
      void router.push(`/tasks/${slug}`);
    }
  };

  const statusLabel = getStatusLabel(task.status);
  const priorityLabel = getPriorityLabelRu(task.priority) || 'Не задан';
  const authorInfo = buildUserInfo(task.authorName, task.authorEmail);

  const renderUserCell = (info: { primary: string; secondary: string; initials: string }) => {
    if (!info.primary || info.primary === '—') {
      return (
        <Typography variant='body2' color='text.secondary' align='center'>
          —
        </Typography>
      );
    }
    return (
      <Stack direction='row' spacing={1} alignItems='center'>
        <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
          {info.initials}
        </Avatar>
        <Box>
          <Typography variant='body2'>{info.primary}</Typography>
          {info.secondary && (
            <Typography variant='caption' color='text.secondary'>
              {info.secondary}
            </Typography>
          )}
        </Box>
      </Stack>
    );
  };

  return (
    <TableRow hover sx={{ cursor: 'pointer' }} onClick={handleRowClick}>
      {columnVisibility.taskId && (
        <TableCell align='center'>
          <Typography variant='body2' fontWeight={600}>
            {task.taskId}
          </Typography>
        </TableCell>
      )}

      {columnVisibility.task && (
        <TableCell>
          <Typography variant='subtitle2'>{task.taskName}</Typography>
          <Typography variant='body2' color='text.secondary'>
            {task.bsNumber || '—'}
          </Typography>
        </TableCell>
      )}

      {columnVisibility.project && (
        <TableCell align='center'>
          <Typography variant='subtitle2'>
            {task.projectKey || '—'}
          </Typography>
        </TableCell>
      )}

      {columnVisibility.author && (
        <TableCell>{renderUserCell(authorInfo)}</TableCell>
      )}

      {columnVisibility.created && (
        <TableCell align='center'>{formatDateRU(task.createdAt)}</TableCell>
      )}

      {columnVisibility.due && (
        <TableCell align='center'>{formatDateRU(task.dueDate)}</TableCell>
      )}

      {columnVisibility.complete && (
        <TableCell align='center'>
          {formatDateRU(task.workCompletionDate) || '—'}
        </TableCell>
      )}

      {columnVisibility.status && (
        <TableCell align='center'>
          <Chip
            label={statusLabel}
            size='small'
            sx={{
              backgroundColor: getStatusColor(task.status),
              color: '#fff',
              fontWeight: 600,
            }}
          />
        </TableCell>
      )}

      {columnVisibility.priority && (
        <TableCell align='center'>
          {getPriorityIcon(task.priority) ? (
            <Tooltip title={priorityLabel}>
              <Box
                component='span'
                sx={{ display: 'inline-flex', alignItems: 'center' }}
              >
                {getPriorityIcon(task.priority)}
              </Box>
            </Tooltip>
          ) : (
            <Typography variant='body2' color='text.secondary'>
              —
            </Typography>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}

/* ───────────── основной компонент ───────────── */
const TaskListPage = forwardRef<TaskListPageHandle, TaskListPageProps>(function TaskListPageInner(
  {
    searchQuery = '',
    projectFilter = '',
    refreshToken = 0,
    hideToolbarControls = false,
    onFilterToggleChange,
  },
  ref
) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ----- фильтры ----- */
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [createdDateRange, setCreatedDateRange] = useState<DateRange<Date>>([null, null]);
  const [dueDateRange, setDueDateRange] = useState<DateRange<Date>>([null, null]);

  /* ----- видимость колонок ----- */
  const [columnVisibility, setColumnVisibility] = useState<Record<
    ColumnKey,
    boolean
  >>({ ...DEFAULT_COLUMN_VISIBILITY });

  /* ----- popover / пагинация ----- */
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [currentFilter, setCurrentFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10); // -1 = All
  const [showFilters, setShowFilters] = useState(false);

  /* ----- пагинация ----- */
  const paginatedTasks = useMemo(() => {
    if (rowsPerPage === -1) return filteredTasks;
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredTasks.slice(startIndex, startIndex + rowsPerPage);
  }, [currentPage, filteredTasks, rowsPerPage]);

  const totalPages = useMemo(() => {
    if (rowsPerPage === -1) return 1;
    return Math.ceil(filteredTasks.length / rowsPerPage);
  }, [filteredTasks, rowsPerPage]);

  const activeFiltersCount = useMemo(
      () =>
          [
            authorFilter,
            statusFilter,
            priorityFilter,
            createdDateRange[0] || createdDateRange[1] ? createdDateRange : null,
            dueDateRange[0] || dueDateRange[1] ? dueDateRange : null,
          ].filter(Boolean).length,
      [
        authorFilter,
        statusFilter,
        priorityFilter,
        createdDateRange,
        dueDateRange,
      ]
  );

  const uniqueValues = useMemo(
      () => ({
        authors: Array.from(
          new Set(
            tasks
              .map((t) => (t.authorName || t.authorEmail)?.trim())
              .filter((name): name is string => Boolean(name))
          )
        ),
        statuses: Array.from(new Set(tasks.map((t) => t.status))),
        priorities: Array.from(new Set(tasks.map((t) => t.priority))),
      }),
      [tasks]
  );

  /* ----- загрузка задач и роли пользователя ----- */
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch('/api/tasks');
        const data = await response.json();
        if (!response.ok) {
          setError(data.error || 'Failed to fetch tasks');
          return;
        }


        setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    void fetchTasks();

  }, [refreshToken]);

  /* ----- читаем статус из query-строки безопасно ----- */
  const searchParams = useSearchParams();

  useEffect(() => {
    const statusParam = searchParams?.get('status'); // ← ❗ безопасно
    if (statusParam) setStatusFilter(statusParam);
  }, [searchParams]);

  /* ----- применение фильтров ----- */
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const normalizedProject = projectFilter.trim().toLowerCase();

  useEffect(() => {
    let filtered = [...tasks];

    if (authorFilter) {
      filtered = filtered.filter(
        (t) => ((t.authorName || t.authorEmail)?.trim() || '') === authorFilter
      );
    }
    if (statusFilter)    filtered = filtered.filter((t) => t.status        === statusFilter);
    if (priorityFilter)  filtered = filtered.filter((t) => t.priority      === priorityFilter);
    if (normalizedProject) {
      filtered = filtered.filter(
        (t) => (t.projectKey || '').toLowerCase() === normalizedProject
      );
    }

    if (createdDateRange[0] && createdDateRange[1]) {
      filtered = filtered.filter((t) => {
        const d = new Date(t.createdAt);
        return d >= createdDateRange[0]! && d <= createdDateRange[1]!;
      });
    }
    if (dueDateRange[0] && dueDateRange[1]) {
      filtered = filtered.filter((t) => {
        const d = new Date(t.dueDate);
        return d >= dueDateRange[0]! && d <= dueDateRange[1]!;
      });
    }
    if (normalizedSearch) {
      filtered = filtered.filter((t) => {
        const haystack = [
          t.taskId,
          t.taskName,
          t.bsNumber,
          t.projectKey,
          t.projectName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      });
    }

    setFilteredTasks(filtered);
    setCurrentPage(1);
  }, [
    tasks,
    createdDateRange,
    dueDateRange,
    authorFilter,
    statusFilter,
    priorityFilter,
    normalizedSearch,
    normalizedProject,
  ]);

  /* ----- popover helpers ----- */
  const handleFilterClick = (e: React.MouseEvent<HTMLElement>, type: string) => {
    if (!showFilters && type !== 'columns') return;
    setAnchorEl(e.currentTarget);
    setCurrentFilter(type);
  };
  const handleClose = () => {
    setAnchorEl(null);
    setCurrentFilter('');
  };
  const handleColumnVisibilityChange =
    (col: ColumnKey) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setColumnVisibility((prev) => ({ ...prev, [col]: e.target.checked }));

  const toggleFilters = useCallback(() => {
    setShowFilters((prev) => {
      const next = !prev;
      if (!next) {
        setAnchorEl(null);
        setCurrentFilter('');
      }
      onFilterToggleChange?.(next);
      return next;
    });
  }, [onFilterToggleChange]);

  const openColumns = useCallback((anchor: HTMLElement) => {
    if (anchor) {
      setAnchorEl(anchor);
      setCurrentFilter('columns');
    }
  }, []);

  const closeColumns = useCallback(() => {
    setAnchorEl(null);
    setCurrentFilter((prev) => (prev === 'columns' ? '' : prev));
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      toggleFilters,
      openColumns,
      closeColumns,
      showFilters,
    }),
    [toggleFilters, openColumns, closeColumns, showFilters]
  );

  /* ----- loading / error UI ----- */
  if (loading)
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, p: 5 }}>
          <CircularProgress />
        </Box>
    );
  if (error) return <Alert severity='error'>{error}</Alert>;
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ width: '100%', margin: '0 auto' }}>
        {showFilters && activeFiltersCount > 0 && (
          <Box sx={{ p: 2, mb: 2 }}>
            <Typography variant='subtitle1'>
              Активные фильтры: {activeFiltersCount}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', my: 1 }}>
              {[
                {
                  label: 'Менеджер',
                  value: authorFilter,
                  reset: () => setAuthorFilter(null),
                },
                {
                  label: 'Статус',
                  value: statusFilter,
                  reset: () => setStatusFilter(''),
                  format: getStatusLabel,
                },
                {
                  label: 'Приоритет',
                  value: priorityFilter,
                  reset: () => setPriorityFilter(''),
                  format: getPriorityLabelRu,
                },
              ].map(
                ({ label, value, reset, format }) =>
                  value && (
                    <Chip
                      key={label}
                      label={`${label}: ${
                        typeof value === 'string'
                          ? format
                            ? format(value)
                            : value
                          : value
                      }`}

                      onDelete={reset}
                      color='primary'
                      size='small'
                    />
                  )
              )}

              {createdDateRange[0] && createdDateRange[1] && (
                <Chip
                  key='created-range'
                  label={`Создано: ${createdDateRange[0].toLocaleDateString()} - ${createdDateRange[1].toLocaleDateString()}`}
                  onDelete={() => setCreatedDateRange([null, null])}
                  color='primary'
                  size='small'
                />
              )}
              {dueDateRange[0] && dueDateRange[1] && (
                <Chip
                  key='due-range'
                  label={`Срок: ${dueDateRange[0].toLocaleDateString()} - ${dueDateRange[1].toLocaleDateString()}`}
                  onDelete={() => setDueDateRange([null, null])}
                  color='primary'
                  size='small'
                />
              )}
            </Box>
            <Button
              onClick={() => {
                setAuthorFilter(null);
                setStatusFilter('');
                setPriorityFilter('');
                setCreatedDateRange([null, null]);
                setDueDateRange([null, null]);
              }}
            >
              Сбросить фильтры
            </Button>
          </Box>
        )}

        {!hideToolbarControls && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 1 }}>
            <Tooltip title={showFilters ? 'Скрыть фильтры' : 'Показать фильтры'}>
              <IconButton
                onClick={toggleFilters}
                color={showFilters ? 'primary' : 'default'}
              >
                <FilterAltIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title='Настроить колонки'>
              <IconButton onClick={(e) => handleFilterClick(e, 'columns')}>
                <ViewColumnIcon />
              </IconButton>
            </Tooltip>
          </Box>
        )}

        <TableContainer component={Box}>
          <Table>
            <TableHead>
              <TableRow>
                {columnVisibility.taskId && (
                    <TableCell
                        sx={{
                          whiteSpace: 'nowrap',
                          padding: '16px',
                          textAlign: 'center',
                        }}
                    >
                      <strong>ID</strong>
                    </TableCell>
                )}


                {columnVisibility.task && (
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <strong>{COLUMN_LABELS.task}</strong>
                  </TableCell>
                )}

                {columnVisibility.project && (
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <strong>Проект</strong>
                  </TableCell>
                )}

                {columnVisibility.author && (
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <strong>{COLUMN_LABELS.author}</strong>
                    {showFilters && (
                      <Tooltip title='Фильтр по менеджеру'>
                        <IconButton
                          onClick={(e) => handleFilterClick(e, 'author')}
                          color={authorFilter ? 'primary' : 'default'}
                        >
                          <PersonSearchIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                )}

                {columnVisibility.created && (
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <strong>{COLUMN_LABELS.created}</strong>
                    {showFilters && (
                      <Tooltip title='Фильтр по дате создания'>
                        <IconButton
                          onClick={(e) => handleFilterClick(e, 'created')}
                          color={
                            createdDateRange[0] || createdDateRange[1]
                              ? 'primary'
                              : 'default'
                          }
                        >
                          <FilterListIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                )}

                {columnVisibility.due && (
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <strong>{COLUMN_LABELS.due}</strong>
                    {showFilters && (
                      <Tooltip title='Фильтр по сроку'>
                        <IconButton
                          onClick={(e) => handleFilterClick(e, 'due')}
                          color={
                            dueDateRange[0] || dueDateRange[1]
                              ? 'primary'
                              : 'default'
                          }
                        >
                          <FilterListIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                )}

                {columnVisibility.complete && (
                    <TableCell
                        sx={{ whiteSpace: 'nowrap', padding: '16px', textAlign: 'center' }}
                    >
                      <strong>{COLUMN_LABELS.complete}</strong>
                    </TableCell>
                )}

                {columnVisibility.status && (
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <strong>{COLUMN_LABELS.status}</strong>
                    {showFilters && (
                      <Tooltip title='Фильтр по статусу'>
                        <IconButton
                          onClick={(e) => handleFilterClick(e, 'status')}
                          color={statusFilter ? 'primary' : 'default'}
                        >
                          <FilterListIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                )}

                {columnVisibility.priority && (
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <strong>{COLUMN_LABELS.priority}</strong>
                    {showFilters && (
                      <Tooltip title='Фильтр по приоритету'>
                        <IconButton
                          onClick={(e) => handleFilterClick(e, 'priority')}
                          color={priorityFilter ? 'primary' : 'default'}
                        >
                          <FilterListIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                )}
              </TableRow>
            </TableHead>

            <TableBody>
              {paginatedTasks.map((task) => (
                <Row
                  key={task.taskId}
                  task={task}
                  columnVisibility={columnVisibility}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Селект для выбора количества строк */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <FormControl sx={{ minWidth: 120 }} size='small'>
            <InputLabel id='rows-per-page-label'>
              Записей на странице
            </InputLabel>
            <Select
              labelId='rows-per-page-label'
              id='rows-per-page'
              value={rowsPerPage}
              onChange={(e) => {
                const value = Number(e.target.value);
                setRowsPerPage(value);
                setCurrentPage(1);
              }}
              label='Записей на странице'
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
              <MenuItem value={-1}>Все</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Пагинация */}
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={(_e, page) => setCurrentPage(page)}
            color='primary'
            showFirstButton
            showLastButton
          />
        </Box>

        <Popover
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          slotProps={{ paper: { sx: { overflow: 'visible' } } }}
        >
          <Box
            sx={{
              p: 2,
              minWidth: currentFilter === 'author' ? 360 : 200,
            }}
          >
            {currentFilter === 'author' && (
              <Box sx={{ width: 360 }}>
                <Autocomplete<string, false, false, false>
                  options={uniqueValues.authors}
                  value={authorFilter}
                  onChange={(_e, value) => setAuthorFilter(value)}
                  clearOnEscape
                  handleHomeEndKeys
                  fullWidth
                  renderInput={(params) => (
                    <TextField {...params} label='Менеджер' size='small' autoFocus />
                  )}
                  slotProps={{
                    popper: { disablePortal: true },
                    paper: { sx: { overflow: 'visible', maxHeight: 'none' } },
                  }}
                  ListboxProps={{ style: { maxHeight: 'none' } }}
                />
              </Box>
            )}


            {currentFilter === 'created' && (
              <DateRangePicker
                value={createdDateRange}
                onChange={(newValue) => setCreatedDateRange(newValue)}
                slots={{ field: SingleInputDateRangeField }}
              />
            )}

            {currentFilter === 'due' && (
              <DateRangePicker
                value={dueDateRange}
                onChange={(newValue) => setDueDateRange(newValue)}
                slots={{ field: SingleInputDateRangeField }}
              />
            )}

            {currentFilter === 'status' && (
              <FormControl fullWidth>
                <InputLabel>Статус</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value=''>
                    <em>Все</em>
                  </MenuItem>
                  {uniqueValues.statuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {getStatusLabel(status)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {currentFilter === 'priority' && (
              <FormControl fullWidth>
                <InputLabel>Приоритет</InputLabel>
                <Select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <MenuItem value=''>
                    <em>Все</em>
                  </MenuItem>
                  {uniqueValues.priorities.map((priority) => (
                    <MenuItem key={priority} value={priority}>
                      {getPriorityLabelRu(priority)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {currentFilter === 'columns' && (
              <>
                <List>
                  {COLUMN_KEYS.map((column) => (
                      <ListItem key={column} dense component='button'>
                        <ListItemIcon>
                          <Checkbox
                            edge='start'
                            checked={columnVisibility[column]}
                            onChange={handleColumnVisibilityChange(column)}
                            tabIndex={-1}
                            disableRipple
                          />
                        </ListItemIcon>
                        <ListItemText primary={COLUMN_LABELS[column]} />
                      </ListItem>
                    ))}

                </List>
                <Box
                  sx={{
                    mt: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <Button
                    onClick={() =>
                      setColumnVisibility(
                        COLUMN_KEYS.reduce(
                          (acc, key) => ({ ...acc, [key]: true }),
                          {} as Record<ColumnKey, boolean>
                        )
                      )
                    }
                  >
                    Все
                  </Button>
                  <Button
                    onClick={() =>
                      setColumnVisibility(
                        COLUMN_KEYS.reduce(
                          (acc, key) => ({ ...acc, [key]: false }),
                          {} as Record<ColumnKey, boolean>
                        )
                      )
                    }
                  >
                    Очистить
                  </Button>
                </Box>
              </>
            )}

            <Box
              sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}
            ></Box>
          </Box>
        </Popover>
      </Box>
    </LocalizationProvider>
  );
});

export default TaskListPage;

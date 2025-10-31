// app/components/TaskListPage.tsx

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import {
  Box,
  Collapse,
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
  TextField,
  InputLabel,
  FormControl,
  Button,
  Popover,
  Tooltip,
  Link,
  Chip,
  Checkbox,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
} from '@mui/material';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { SingleInputDateRangeField } from '@mui/x-date-pickers-pro/SingleInputDateRangeField';
import { DateRange } from '@mui/x-date-pickers-pro/models';
import Pagination from '@mui/material/Pagination';
import {
  KeyboardDoubleArrowUp as KeyboardDoubleArrowUpIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  DragHandle as DragHandleIcon,
  Remove as RemoveIcon,
  ViewColumn as ViewColumnIcon,
  FilterList as FilterListIcon,
  Search as SearchIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Task as TaskIcon
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Task, WorkItem } from '../types/taskTypes';
import { GetCurrentUserFromMongoDB } from 'src/server-actions/users';
import { getStatusColor } from '@/utils/statusColors';

/* ───────────── вспомогательные элементы ───────────── */
const getPriorityIcon = (priority: string) => {
  switch (priority) {
    case 'low':
      return <RemoveIcon sx={{ color: '#28a0e9' }} />;
    case 'medium':
      return <DragHandleIcon sx={{ color: '#df9b18' }} />;
    case 'high':
      return <KeyboardArrowUpIcon sx={{ color: '#ca3131' }} />;
    case 'urgent':
      return <KeyboardDoubleArrowUpIcon sx={{ color: '#ff0000' }} />;
    default:
      return null;
  }
};

/* ───────────── формат даты dd.mm.yyyy ───────────── */
const formatDateRU = (value?: Date | string) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU'); // dd.mm.yyyy
};


/* ───────────── утилита скачивания order и ncw ───────────── */
async function downloadFile(url: string, fallbackName: string) {
  // 1) fetch без throw
  const res = await fetch(url, { credentials: 'include' }).catch((e) => {
    console.error('Download failed: fetch error', e);
    return null;
  });

  if (!res || !res.ok) {
    console.error(`Download failed: ${res ? `HTTP ${res.status}` : 'no response'}`);
    return;
  }

  // 2) получаем blob
  const blob = await res.blob();

  // 3) безопасно достаём имя файла из URL
  let nameFromUrl = fallbackName;
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    if (last) nameFromUrl = last;
  } catch {
    /* ignore bad URL, keep fallback */
  }

  // 4) скачивание
  const a = document.createElement('a');
  const objUrl = URL.createObjectURL(blob);
  a.href = objUrl;
  a.download = nameFromUrl;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(objUrl);
  a.remove();
}



/* ───────────── строка задачи ───────────── */
function Row({
               task,
               columnVisibility,
               role,
             }: {
  task: Task;
  columnVisibility: Record<string, boolean>;
  role: string;
}) {
  const [open, setOpen] = useState(false);

  const parseUserInfo = (userString?: string) => {
    if (!userString) return { name: 'N/A', email: 'N/A' };
    const cleanedString = userString.replace(/\)$/, '');
    const parts = cleanedString.split(' (');
    return {
      name: parts[0] || 'N/A',
      email: parts[1] || 'N/A',
    };
  };

  // Считаем видимые колонки с учётом роли (executor не видит order/ncw,
  // роль author не видит author-колонку; роль executor не видит executor-колонку — уже учтено в разметке)
  const visibleColsCount = Object.entries(columnVisibility).filter(([key, val]) =>
      val &&
      !(role === 'executor' && (key === 'order' || key === 'ncw' || key === 'executor')) &&
      !(role === 'author' && key === 'author')
  ).length;



  return (
      <>
        <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
          <TableCell>
            <IconButton size='small' onClick={() => setOpen(!open)}>
              {open ? <KeyboardArrowDownIcon /> : <KeyboardArrowDownIcon sx={{ transform: 'rotate(-90deg)' }} />}
            </IconButton>
          </TableCell>

          {columnVisibility.taskId && (
              <TableCell align="center">
                <Typography variant="body2">
                  {task.taskId}
                </Typography>
              </TableCell>
          )}


          {columnVisibility.task && (
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Link href={`/tasks/${task.taskId.toLowerCase()}`} sx={{ cursor: 'pointer' }}>
                    {task.taskName} | {task.bsNumber}
                  </Link>
                </Box>
              </TableCell>
          )}

          {columnVisibility.author && (
              <TableCell align='center'>
                <Typography variant='subtitle2'>{parseUserInfo(task.authorName).name}</Typography>
              </TableCell>
          )}

          {columnVisibility.initiator && (
              <TableCell align='center'>
                <Typography variant='subtitle2'>{parseUserInfo(task.initiatorName).name}</Typography>
              </TableCell>
          )}

          {role !== 'executor' && columnVisibility.executor && (
              <TableCell align='center'>
                <Typography variant='subtitle2'>{parseUserInfo(task.executorName).name}</Typography>
              </TableCell>
          )}

          {columnVisibility.created && (
              <TableCell align='center'>{new Date(task.createdAt).toLocaleDateString()}</TableCell>
          )}

          {columnVisibility.due && (
              <TableCell align='center'>{formatDateRU(task.dueDate)}</TableCell>
          )}

          {columnVisibility.complete && (
              <TableCell align='center'>
                {formatDateRU(task.workCompletionDate)}
              </TableCell>
          )}


          {columnVisibility.status && (
              <TableCell align='center'>
                <Chip label={task.status} sx={{ backgroundColor: getStatusColor(task.status), color: '#fff' }} />
              </TableCell>
          )}

          {role !== 'executor' && columnVisibility.order && (
              <TableCell align="center">
                {!!task.orderUrl && (
                    <Tooltip title="Download Order">
                      <IconButton
                          size="small"
                          onClick={() => downloadFile(task.orderUrl!, `${task.taskId}_order.pdf`)}
                      >
                        <TaskIcon sx={{ color: 'success.main' }} />
                      </IconButton>
                    </Tooltip>
                )}
              </TableCell>
          )}


          {role !== 'executor' && columnVisibility.ncw && (
              <TableCell align="center">
                {!!task.ncwUrl && (
                    <Tooltip title="Download NCW">
                      <IconButton
                          size="small"
                          onClick={() => downloadFile(task.ncwUrl!, `${task.taskId}_ncw.pdf`)}
                      >
                        <TaskIcon sx={{ color: 'success.main' }} />
                      </IconButton>
                    </Tooltip>
                )}
              </TableCell>
          )}


          {columnVisibility.priority && (
              <TableCell align='center'>
                {getPriorityIcon(task.priority)}
                {task.priority}
              </TableCell>
          )}
        </TableRow>

        <TableRow>
          <TableCell
              colSpan={1 + visibleColsCount}
              sx={{ p: 0 }}
          >
          <Collapse in={open} timeout='auto' unmountOnExit>
              <Box sx={{ ml: 3, mt: 2 }}>
                <Typography variant='subtitle1'>BS Number</Typography>
                <Typography variant='body2' color='text.secondary'>
                  {task.bsNumber}
                </Typography>

                <Typography variant='subtitle1'>Address</Typography>
                <Typography variant='body2' color='text.secondary'>
                  {task.bsAddress}
                </Typography>

                {role !== 'executor' && (
                    <>
                      <Typography variant='subtitle1'>Cost</Typography>
                      <Typography variant='body2'>{task.totalCost}</Typography>
                    </>
                )}

                <Typography variant='h6' sx={{ mt: 2 }}>
                  Work Items
                </Typography>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>Work Type</TableCell>
                      <TableCell>Quantity</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell>Note</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {task.workItems.map((item: WorkItem) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.workType}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell>{item.note}</TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <Box sx={{ display: 'flex', mt: 2, mb: 1 }}>
                  <Button href={`/tasks/${task.taskId.toLowerCase()}`} variant='contained' size='small'>
                    More
                  </Button>
                </Box>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      </>
  );
}

/* ───────────── основной компонент ───────────── */
export default function TaskListPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');

  /* ----- фильтры ----- */
  const [authorFilter, setAuthorFilter] = useState('');
  const [initiatorFilter, setInitiatorFilter] = useState('');
  const [executorFilter, setExecutorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [createdDateRange, setCreatedDateRange] = useState<DateRange<Date>>([null, null]);
  const [dueDateRange, setDueDateRange] = useState<DateRange<Date>>([null, null]);
  const [bsSearch, setBsSearch] = useState('');

  /* ----- видимость колонок ----- */
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    taskId: true,
    task: true,
    author: true,
    initiator: true,
    executor: true,
    created: true,
    due: true,
    complete: true,
    status: true,
    priority: true,
    order: true,
    ncw: true,
  });

  /* ----- popover / пагинация ----- */
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [currentFilter, setCurrentFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10); // -1 = All

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

  const isDateString = (s: string) => !Number.isNaN(Date.parse(s));


  const activeFiltersCount = useMemo(
      () =>
          [
            authorFilter,
            initiatorFilter,
            executorFilter,
            statusFilter,
            priorityFilter,
            createdDateRange[0] || createdDateRange[1] ? createdDateRange : null,
            dueDateRange[0] || dueDateRange[1] ? dueDateRange : null,
            bsSearch,
          ].filter(Boolean).length,
      [
        authorFilter,
        initiatorFilter,
        executorFilter,
        statusFilter,
        priorityFilter,
        createdDateRange,
        dueDateRange,
        bsSearch,
      ]
  );

  const uniqueValues = useMemo(
      () => ({
        authors: Array.from(new Set(tasks.map((t) => t.authorName))),
        initiators: Array.from(new Set(tasks.map((t) => t.initiatorName))),
        executors: Array.from(new Set(tasks.map((t) => t.executorName))),
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


        const tasksWithId = data.tasks.map((task: Task) => ({
          ...task,
          workItems: task.workItems.map((wi: WorkItem) => ({ ...wi, id: uuidv4() })),
        }));
        setTasks(tasksWithId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    const fetchUserRole = async () => {
      try {
        const res = await GetCurrentUserFromMongoDB();
        if (res.success && res.data) setRole(res.data.role);
      } catch (err) {
        console.error('Error fetching user role:', err);
      }
    };

    void fetchTasks();
    void fetchUserRole();

  }, []);

  /* ----- читаем статус из query-строки безопасно ----- */
  const searchParams = useSearchParams();

  useEffect(() => {
    const statusParam = searchParams?.get('status'); // ← ❗ безопасно
    if (statusParam) setStatusFilter(statusParam);
  }, [searchParams]);

  /* ----- применение фильтров ----- */
  useEffect(() => {
    let filtered = [...tasks];

    if (authorFilter)    filtered = filtered.filter((t) => t.authorName    === authorFilter);
    if (initiatorFilter) filtered = filtered.filter((t) => t.initiatorName === initiatorFilter);
    if (executorFilter)  filtered = filtered.filter((t) => t.executorName  === executorFilter);
    if (statusFilter)    filtered = filtered.filter((t) => t.status        === statusFilter);
    if (priorityFilter)  filtered = filtered.filter((t) => t.priority      === priorityFilter);

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
    if (bsSearch) filtered = filtered.filter((t) => t.bsNumber.toLowerCase().includes(bsSearch.toLowerCase()));

    setFilteredTasks(filtered);
    setCurrentPage(1);
  }, [
    tasks,
    createdDateRange,
    dueDateRange,
    authorFilter,
    initiatorFilter,
    executorFilter,
    statusFilter,
    priorityFilter,
    bsSearch,
  ]);

  /* ----- popover helpers ----- */
  const handleFilterClick = (e: React.MouseEvent<HTMLElement>, type: string) => {
    setAnchorEl(e.currentTarget);
    setCurrentFilter(type);
  };
  const handleClose = () => {
    setAnchorEl(null);
    setCurrentFilter('');
  };
  const handleColumnVisibilityChange =
      (col: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
          setColumnVisibility((prev) => ({ ...prev, [col]: e.target.checked }));

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
        {activeFiltersCount > 0 && (
          <Box sx={{ p: 2, mb: 2 }}>
            <Typography variant='subtitle1'>
              Active filters {activeFiltersCount}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', my: 1 }}>
              {[
                {
                  label: 'Author',
                  value: authorFilter,
                  reset: () => setAuthorFilter(''),
                },
                {
                  label: 'Initiator',
                  value: initiatorFilter,
                  reset: () => setInitiatorFilter(''),
                },
                {
                  label: 'Executor',
                  value: executorFilter,
                  reset: () => setExecutorFilter(''),
                },
                {
                  label: 'Status',
                  value: statusFilter,
                  reset: () => setStatusFilter(''),
                },
                {
                  label: 'Priority',
                  value: priorityFilter,
                  reset: () => setPriorityFilter(''),
                },
                {
                  label: 'BS Number',
                  value: bsSearch,
                  reset: () => setBsSearch(''),
                },
              ].map(
                ({ label, value, reset }) =>
                  value && (
                    <Chip
                      key={label}
                      label={`${label}: ${
                          label !== 'BS Number' && isDateString(value as string)
                              ? new Date(value as string).toLocaleDateString()
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
                  label={`Created: ${createdDateRange[0].toLocaleDateString()} - ${createdDateRange[1].toLocaleDateString()}`}
                  onDelete={() => setCreatedDateRange([null, null])}
                  color='primary'
                  size='small'
                />
              )}
              {dueDateRange[0] && dueDateRange[1] && (
                <Chip
                  key='due-range'
                  label={`Due Date: ${dueDateRange[0].toLocaleDateString()} - ${dueDateRange[1].toLocaleDateString()}`}
                  onDelete={() => setDueDateRange([null, null])}
                  color='primary'
                  size='small'
                />
              )}
            </Box>
            <Button
              onClick={() => {
                setAuthorFilter('');
                setInitiatorFilter('');
                setExecutorFilter('');
                setStatusFilter('');
                setPriorityFilter('');
                setCreatedDateRange([null, null]);
                setDueDateRange([null, null]);
                setBsSearch('');
              }}
            >
              Clear All
            </Button>
          </Box>
        )}

        <TableContainer component={Box}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    whiteSpace: 'nowrap',
                    padding: '16px',
                    textAlign: 'center',
                  }}
                >
                  <Tooltip title='Manage columns'>
                    <IconButton
                      onClick={(e) => handleFilterClick(e, 'columns')}
                    >
                      <ViewColumnIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>

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
                    <strong>Task</strong>
                    <Tooltip title='Search BS Number'>
                      <IconButton
                        onClick={(e) => handleFilterClick(e, 'bs')}
                        color={bsSearch ? 'primary' : 'default'}
                      >
                        <SearchIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}

                {/* Скрываем столбец Author для роли author */}
                {role !== 'author' && columnVisibility.author && (
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <strong>Author</strong>
                    <Tooltip title='Filter by Author'>
                      <IconButton
                        onClick={(e) => handleFilterClick(e, 'author')}
                        color={authorFilter ? 'primary' : 'default'}
                      >
                        <FilterListIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}

                {columnVisibility.initiator && (
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <strong>Initiator</strong>
                    <Tooltip title='Filter by Initiator'>
                      <IconButton
                        onClick={(e) => handleFilterClick(e, 'initiator')}
                        color={initiatorFilter ? 'primary' : 'default'}
                      >
                        <FilterListIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}

                {/* Скрываем столбец Executor для роли executor */}
                {role !== 'executor' && columnVisibility.executor && (
                  <TableCell
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                      textAlign: 'center',
                    }}
                  >
                    <strong>Executor</strong>
                    <Tooltip title='Filter by Executor'>
                      <IconButton
                        onClick={(e) => handleFilterClick(e, 'executor')}
                        color={executorFilter ? 'primary' : 'default'}
                      >
                        <FilterListIcon />
                      </IconButton>
                    </Tooltip>
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
                    <strong>Created</strong>
                    <Tooltip title='Filter by Creation Date'>
                      <IconButton
                        onClick={(e) => handleFilterClick(e, 'created')}
                        color={
                          createdDateRange[0] || createdDateRange[1]
                            ? 'primary'
                            : 'default'
                        }
                      >
                        <FilterListIcon />
                      </IconButton>
                    </Tooltip>
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
                    <strong>Due Date</strong>
                    <Tooltip title='Filter by Due Date'>
                      <IconButton
                        onClick={(e) => handleFilterClick(e, 'due')}
                        color={
                          dueDateRange[0] || dueDateRange[1]
                            ? 'primary'
                            : 'default'
                        }
                      >
                        <FilterListIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}

                {columnVisibility.complete && (
                    <TableCell
                        sx={{ whiteSpace: 'nowrap', padding: '16px', textAlign: 'center' }}
                    >
                      <strong>Complete</strong>
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
                    <strong>Status</strong>
                    <Tooltip title='Filter by Status'>
                      <IconButton
                        onClick={(e) => handleFilterClick(e, 'status')}
                        color={statusFilter ? 'primary' : 'default'}
                      >
                        <FilterListIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}

                {role !== 'executor' && columnVisibility.order && (
                    <TableCell sx={{ whiteSpace: 'nowrap', padding: '16px', textAlign: 'center' }}>
                      <strong>Order</strong>
                    </TableCell>
                )}
                {role !== 'executor' && columnVisibility.ncw && (
                    <TableCell sx={{ whiteSpace: 'nowrap', padding: '16px', textAlign: 'center' }}>
                      <strong>NCW</strong>
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
                    <strong>Priority</strong>
                    <Tooltip title='Filter by Priority'>
                      <IconButton
                        onClick={(e) => handleFilterClick(e, 'priority')}
                        color={priorityFilter ? 'primary' : 'default'}
                      >
                        <FilterListIcon />
                      </IconButton>
                    </Tooltip>
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
                  role={role}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Селект для выбора количества строк */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <FormControl sx={{ minWidth: 120 }} size='small'>
            <InputLabel id='rows-per-page-label'>Items number</InputLabel>
            <Select
              labelId='rows-per-page-label'
              id='rows-per-page'
              value={rowsPerPage}
              onChange={(e) => {
                const value = Number(e.target.value);
                setRowsPerPage(value);
                setCurrentPage(1);
              }}
              label='Items number'
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
        >
          <Box sx={{ p: 2, minWidth: 200 }}>
            {currentFilter === 'bs' && (
              <TextField
                label='Search'
                value={bsSearch}
                onChange={(e) => setBsSearch(e.target.value)}
                fullWidth
                autoFocus
              />
            )}

            {currentFilter === 'author' && (
              <FormControl fullWidth>
                <InputLabel>Author</InputLabel>
                <Select
                  value={authorFilter}
                  onChange={(e) => setAuthorFilter(e.target.value)}
                >
                  <MenuItem value=''>
                    <em>All</em>
                  </MenuItem>
                  {uniqueValues.authors.map((author) => (
                    <MenuItem key={author} value={author}>
                      {author}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {currentFilter === 'initiator' && (
              <FormControl fullWidth>
                <InputLabel>Initiator</InputLabel>
                <Select
                  value={initiatorFilter}
                  onChange={(e) => setInitiatorFilter(e.target.value)}
                >
                  <MenuItem value=''>
                    <em>All</em>
                  </MenuItem>
                  {uniqueValues.initiators.map((initiator) => (
                    <MenuItem key={initiator} value={initiator}>
                      {initiator}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {currentFilter === 'executor' && (
              <FormControl fullWidth>
                <InputLabel>Executor</InputLabel>
                <Select
                  value={executorFilter}
                  onChange={(e) => setExecutorFilter(e.target.value)}
                >
                  <MenuItem value=''>
                    <em>All</em>
                  </MenuItem>
                  {uniqueValues.executors.map((executor) => (
                    <MenuItem key={executor} value={executor}>
                      {executor}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value=''>
                    <em>All</em>
                  </MenuItem>
                  {uniqueValues.statuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {currentFilter === 'priority' && (
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <MenuItem value=''>
                    <em>All</em>
                  </MenuItem>
                  {uniqueValues.priorities.map((priority) => (
                    <MenuItem key={priority} value={priority}>
                      {priority}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {currentFilter === 'columns' && (
              <>
                <List>
                  {Object.keys(columnVisibility)
                      .filter((column) => !(role === 'executor' && (column === 'order' || column === 'ncw')))
                      .map((column) => (
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
                            <ListItemText
                                primary={column.charAt(0).toUpperCase() + column.slice(1)}
                            />
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
                    onClick={() => {
                      setColumnVisibility((prev) => {
                        const newVisibility = { ...prev };
                        Object.keys(newVisibility).forEach((key) => {
                          newVisibility[key] = true;
                        });
                        return newVisibility;
                      });
                    }}
                  >
                    All
                  </Button>
                  <Button
                    onClick={() => {
                      setColumnVisibility((prev) => {
                        const newVisibility = { ...prev };
                        Object.keys(newVisibility).forEach((key) => {
                          newVisibility[key] = false;
                        });
                        return newVisibility;
                      });
                    }}
                  >
                    Clear
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
}

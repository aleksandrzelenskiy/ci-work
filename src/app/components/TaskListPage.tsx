// app/components/TaskListPage.tsx

'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
} from '@mui/material';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { SingleInputDateRangeField } from '@mui/x-date-pickers-pro/SingleInputDateRangeField';
import { DateRange } from '@mui/x-date-pickers-pro/models';
import {
  KeyboardDoubleArrowUp as KeyboardDoubleArrowUpIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  DragHandle as DragHandleIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { Task, WorkItem } from '../types/taskTypes';
import { GetCurrentUserFromMongoDB } from 'src/server-actions/users';
import { getStatusColor } from '@/utils/statusColors';

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

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton size='small' onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>

        {columnVisibility.task && (
          <TableCell>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link
                href={`/tasks/${task.taskId.toLowerCase()}`}
                sx={{ cursor: 'pointer' }}
              >
                {task.taskName} | {task.bsNumber}
              </Link>
            </Box>
          </TableCell>
        )}

        {columnVisibility.author && (
          <TableCell align='center'>
            <Box>
              <Typography variant='subtitle2'>
                {parseUserInfo(task.authorName).name}
              </Typography>
            </Box>
          </TableCell>
        )}

        {columnVisibility.initiator && (
          <TableCell align='center'>
            <Box>
              <Typography variant='subtitle2'>
                {parseUserInfo(task.initiatorName).name}
              </Typography>
            </Box>
          </TableCell>
        )}

        {/* Скрываем столбец Executor для роли executor */}
        {role !== 'executor' && columnVisibility.executor && (
          <TableCell align='center'>
            <Box>
              <Typography variant='subtitle2'>
                {parseUserInfo(task.executorName).name}
              </Typography>
            </Box>
          </TableCell>
        )}

        {columnVisibility.created && (
          <TableCell align='center'>
            {new Date(task.createdAt).toLocaleDateString()}
          </TableCell>
        )}

        {columnVisibility.due && (
          <TableCell align='center'>
            {new Date(task.dueDate).toLocaleDateString()}
          </TableCell>
        )}

        {columnVisibility.status && (
          <TableCell align='center'>
            <Chip
              label={task.status}
              sx={{
                backgroundColor: getStatusColor(task.status),
                color: task.status === 'To do' ? '#444' : '#fff',
              }}
            />
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
        <TableCell colSpan={11} style={{ paddingBottom: 0, paddingTop: 0 }}>
          <Collapse in={open} timeout='auto' unmountOnExit>
            <Chip
              label={task.taskId}
              size='small'
              color='primary'
              sx={{ mt: 1, marginLeft: 2 }}
            />

            <Box sx={{ marginLeft: 3 }}>
              <Box sx={{ mb: 2, mt: 2 }}>
                <Typography variant='subtitle1'>BS Number</Typography>
                <Typography
                  variant='body2'
                  color='text.secondary'
                  component='div'
                >
                  {task.bsNumber}
                </Typography>
                <Typography variant='subtitle1'>Address</Typography>
                <Typography
                  variant='body2'
                  color='text.secondary'
                  component='div'
                >
                  {task.bsAddress}
                </Typography>
                {/* <Typography variant='subtitle1'>Location</Typography> */}
                {/* <Typography
                  variant='body2'
                  color='text.secondary'
                  component='div'
                >
                  {task.bsLocation.map((item: BsLocation) => (
                    <Box key={item.coordinates}>
                      <Typography
                        variant='body2'
                        color='text.secondary'
                        component='div'
                      >
                        {item.name} {item.coordinates}
                      </Typography>
                    </Box>
                  ))}
                </Typography> */}
                {role !== 'executor' && (
                  <>
                    <Typography variant='subtitle1'>Cost</Typography>
                    <Typography variant='body2' component='div'>
                      {task.totalCost}
                    </Typography>
                  </>
                )}
              </Box>
              <Typography variant='h6' gutterBottom>
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
              <Box
                display='flex'
                justifyContent='start'
                alignItems='center'
                width='100%'
                sx={{ margin: 2 }}
              >
                <Button
                  href={`/tasks/${task.taskId.toLowerCase()}`}
                  variant='contained'
                  size='small'
                >
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

export default function TaskListPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');

  // Filters
  const [authorFilter, setAuthorFilter] = useState('');
  const [initiatorFilter, setInitiatorFilter] = useState('');
  const [executorFilter, setExecutorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [createdDateRange, setCreatedDateRange] = useState<DateRange<Date>>([
    null,
    null,
  ]);
  const [dueDateRange, setDueDateRange] = useState<DateRange<Date>>([
    null,
    null,
  ]);
  const [bsSearch, setBsSearch] = useState('');

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({
    task: true,
    author: true,
    initiator: true,
    executor: true,
    created: true,
    due: true,
    status: true,
    priority: true,
  });

  // Popover
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [currentFilter, setCurrentFilter] = useState<string>('');

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

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch('/api/tasks');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch tasks');
        }

        const tasksWithId = data.tasks.map((task: Task) => ({
          ...task,
          workItems: task.workItems.map((workItem: WorkItem) => ({
            ...workItem,
            id: uuidv4(),
          })),
        }));

        setTasks(tasksWithId);
        setLoading(false);
      } catch (error) {
        if (error instanceof Error) {
          setError(error.message);
        } else {
          setError('An unknown error occurred');
        }
        setLoading(false);
      }
    };

    const fetchUserRole = async () => {
      try {
        const userResponse = await GetCurrentUserFromMongoDB();
        if (userResponse.success && userResponse.data) {
          const userRole = userResponse.data.role;
          console.log('User role:', userRole);
          setRole(userRole); // Устанавливаем роль в состояние
        } else {
          console.error('Failed to fetch user role:', userResponse.message);
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };

    fetchTasks();
    fetchUserRole();
  }, []);

  useEffect(() => {
    let filtered = [...tasks];

    if (authorFilter)
      filtered = filtered.filter((t) => t.authorName === authorFilter);
    if (initiatorFilter)
      filtered = filtered.filter((t) => t.initiatorName === initiatorFilter);
    if (executorFilter)
      filtered = filtered.filter((t) => t.executorName === executorFilter);
    if (statusFilter)
      filtered = filtered.filter((t) => t.status === statusFilter);
    if (priorityFilter)
      filtered = filtered.filter((t) => t.priority === priorityFilter);
    if (createdDateRange[0] && createdDateRange[1]) {
      filtered = filtered.filter((t) => {
        const taskDate = new Date(t.createdAt);
        return (
          taskDate >= createdDateRange[0]! && taskDate <= createdDateRange[1]!
        );
      });
    }
    if (dueDateRange[0] && dueDateRange[1]) {
      filtered = filtered.filter((t) => {
        const taskDate = new Date(t.dueDate);
        return taskDate >= dueDateRange[0]! && taskDate <= dueDateRange[1]!;
      });
    }
    if (bsSearch)
      filtered = filtered.filter((t) =>
        t.bsNumber.toLowerCase().includes(bsSearch.toLowerCase())
      );

    setFilteredTasks(filtered);
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

  const handleFilterClick = (
    event: React.MouseEvent<HTMLElement>,
    filterType: string
  ) => {
    setAnchorEl(event.currentTarget);
    setCurrentFilter(filterType);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setCurrentFilter('');
  };

  const handleColumnVisibilityChange =
    (column: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setColumnVisibility((prev) => ({
        ...prev,
        [column]: event.target.checked,
      }));
    };

  if (loading)
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          marginTop: '20px',
          padding: 5,
        }}
      >
        <CircularProgress />
      </Box>
    );
  if (error)
    return (
      <Typography color='error' align='center' sx={{ mt: 2 }}>
        {error}
      </Typography>
    );

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
                        typeof value === 'string' && !isNaN(Date.parse(value))
                          ? new Date(value).toLocaleDateString()
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
              {filteredTasks.map((task) => (
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
                  {Object.keys(columnVisibility).map((column) => (
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
                        primary={
                          column.charAt(0).toUpperCase() + column.slice(1)
                        }
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

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
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

import { Task, WorkItem } from '../types/taskTypes';

const getStatusStyles = (status: string) => {
  switch (status) {
    case 'Completed':
      return { backgroundColor: '#d4edda', color: '#155724' };
    case 'In Progress':
      return { backgroundColor: '#fff3cd', color: '#856404' };
    case 'Overdue':
      return { backgroundColor: '#f8d7da', color: '#721c24' };
    default:
      return { backgroundColor: '#f1f1f1', color: '#6c757d' };
  }
};

function Row({ task }: { task: Task }) {
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

        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link sx={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
              {task.taskName} | {task.bsNumber}
            </Link>
          </Box>
        </TableCell>

        <TableCell>
          <Box>
            <Typography variant='subtitle2'>
              {parseUserInfo(task.authorName).name}
            </Typography>
          </Box>
        </TableCell>
        <TableCell>
          <Box>
            <Typography variant='subtitle2'>
              {parseUserInfo(task.initiatorName).name}
            </Typography>
          </Box>
        </TableCell>
        <TableCell>
          <Box>
            <Typography variant='subtitle2'>
              {parseUserInfo(task.executorName).name}
            </Typography>
          </Box>
        </TableCell>
        <TableCell>{new Date(task.createdAt).toLocaleDateString()}</TableCell>
        <TableCell>{new Date(task.dueDate).toLocaleDateString()}</TableCell>
        <TableCell>
          <Chip label={task.status} sx={getStatusStyles(task.status)} />
        </TableCell>
        <TableCell>{task.priority}</TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={11} style={{ paddingBottom: 0, paddingTop: 0 }}>
          <Collapse in={open} timeout='auto' unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Typography variant='h6' gutterBottom>
                Details
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant='subtitle1'>BS Number</Typography>
                <Typography variant='body2' color='text.secondary'>
                  {task.bsNumber}
                </Typography>
                <Typography variant='subtitle1'>Address</Typography>
                <Typography variant='body2' color='text.secondary'>
                  {task.bsAddress}
                </Typography>
                <Typography variant='subtitle1'>Location</Typography>
                <Typography variant='body2' color='text.secondary'>
                  {task.objectDetails?.coordinates || 'N/A'}
                </Typography>
                <Typography variant='subtitle1'>Cost</Typography>
                <Typography variant='body2'>{task.totalCost}</Typography>
                <Typography variant='subtitle1'>Profit</Typography>
                <Typography variant='body2'>{task.totalCost * 0.2}</Typography>
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

  // Filters
  const [authorFilter, setAuthorFilter] = useState('');
  const [initiatorFilter, setInitiatorFilter] = useState('');
  const [executorFilter, setExecutorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [createdAtFilter, setCreatedAtFilter] = useState<Date | null>(null);
  const [dueDateFilter, setDueDateFilter] = useState<Date | null>(null);
  const [bsSearch, setBsSearch] = useState('');

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
        createdAtFilter,
        dueDateFilter,
        bsSearch,
      ].filter(Boolean).length,
    [
      authorFilter,
      initiatorFilter,
      executorFilter,
      statusFilter,
      priorityFilter,
      createdAtFilter,
      dueDateFilter,
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

    fetchTasks();
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
    if (createdAtFilter) {
      const date = new Date(createdAtFilter).setHours(0, 0, 0, 0);
      filtered = filtered.filter(
        (t) => new Date(t.createdAt).setHours(0, 0, 0, 0) === date
      );
    }
    if (dueDateFilter) {
      const date = new Date(dueDateFilter).setHours(0, 0, 0, 0);
      filtered = filtered.filter(
        (t) => new Date(t.dueDate).setHours(0, 0, 0, 0) === date
      );
    }
    if (bsSearch)
      filtered = filtered.filter((t) =>
        t.bsNumber.toLowerCase().includes(bsSearch.toLowerCase())
      );

    setFilteredTasks(filtered);
  }, [
    tasks,
    authorFilter,
    initiatorFilter,
    executorFilter,
    statusFilter,
    priorityFilter,
    createdAtFilter,
    dueDateFilter,
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

  if (loading)
    return <CircularProgress sx={{ display: 'block', margin: '20px auto' }} />;
  if (error)
    return (
      <Typography color='error' align='center' sx={{ mt: 2 }}>
        {error}
      </Typography>
    );

  return (
    <Box sx={{ width: '100%', margin: '0 auto' }}>
      {activeFiltersCount > 0 && (
        <Box sx={{ p: 2, mb: 2 }}>
          <Typography variant='subtitle1'>Active filters</Typography>
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
                label: 'Created',
                value: createdAtFilter,
                reset: () => setCreatedAtFilter(null),
              },
              {
                label: 'Due Date',
                value: dueDateFilter,
                reset: () => setDueDateFilter(null),
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
                      value instanceof Date ? value.toLocaleDateString() : value
                    }`}
                    onDelete={reset}
                    color='primary'
                    size='small'
                  />
                )
            )}
          </Box>
          <Button
            onClick={() => {
              setAuthorFilter('');
              setInitiatorFilter('');
              setExecutorFilter('');
              setStatusFilter('');
              setPriorityFilter('');
              setCreatedAtFilter(null);
              setDueDateFilter(null);
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
              <TableCell />
              <TableCell
                sx={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  padding: '16px',
                }}
              >
                Task
                <Tooltip title='Search BS Number'>
                  <IconButton onClick={(e) => handleFilterClick(e, 'bs')}>
                    <SearchIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
              <TableCell
                sx={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  padding: '16px',
                }}
              >
                Author
                <Tooltip title='Filter by Author'>
                  <IconButton onClick={(e) => handleFilterClick(e, 'author')}>
                    <FilterListIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
              <TableCell
                sx={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  padding: '16px',
                }}
              >
                Initiator
                <Tooltip title='Filter by Initiator'>
                  <IconButton
                    onClick={(e) => handleFilterClick(e, 'initiator')}
                  >
                    <FilterListIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
              <TableCell
                sx={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  padding: '16px',
                }}
              >
                Executor
                <Tooltip title='Filter by Executor'>
                  <IconButton onClick={(e) => handleFilterClick(e, 'executor')}>
                    <FilterListIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
              <TableCell
                sx={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  padding: '16px',
                }}
              >
                Created
                <Tooltip title='Filter by Creation Date'>
                  <IconButton onClick={(e) => handleFilterClick(e, 'created')}>
                    <FilterListIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
              <TableCell
                sx={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  padding: '16px',
                }}
              >
                Due Date
                <Tooltip title='Filter by Due Date'>
                  <IconButton onClick={(e) => handleFilterClick(e, 'due')}>
                    <FilterListIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
              <TableCell
                sx={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  padding: '16px',
                }}
              >
                Status
                <Tooltip title='Filter by Status'>
                  <IconButton onClick={(e) => handleFilterClick(e, 'status')}>
                    <FilterListIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
              <TableCell
                sx={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  padding: '16px',
                }}
              >
                Priority
                <Tooltip title='Filter by Priority'>
                  <IconButton onClick={(e) => handleFilterClick(e, 'priority')}>
                    <FilterListIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredTasks.map((task) => (
              <Row key={task.taskId} task={task} />
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
              label='Search BS Number'
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

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={handleClose}>Close</Button>
            <Button
              onClick={() => {
                switch (currentFilter) {
                  case 'bs':
                    setBsSearch('');
                    break;
                  case 'author':
                    setAuthorFilter('');
                    break;
                  case 'initiator':
                    setInitiatorFilter('');
                    break;
                  case 'executor':
                    setExecutorFilter('');
                    break;
                  case 'status':
                    setStatusFilter('');
                    break;
                  case 'priority':
                    setPriorityFilter('');
                    break;
                }
              }}
            >
              Clear
            </Button>
          </Box>
        </Box>
      </Popover>
    </Box>
  );
}

// app/components/ReportListPage.tsx

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
  Avatar,
  Select,
  MenuItem,
  TextField,
  InputLabel,
  FormControl,
  Grid,
  Button,
  Popover,
  Tooltip,
  Link,
  Chip,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { BaseStatus, ReportClient, ApiResponse } from '../types/reportTypes';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { SingleInputDateRangeField } from '@mui/x-date-pickers-pro/SingleInputDateRangeField';
import { DateRange } from '@mui/x-date-pickers-pro/models';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// Получение стилей для статуса (цвет фона/текста)
const getStatusStyles = (status: string) => {
  switch (status) {
    case 'Agreed':
      return { backgroundColor: '#d4edda', color: '#155724' };
    case 'Pending':
      return { backgroundColor: '#fff3cd', color: '#856404' };
    case 'Issues':
      return { backgroundColor: '#f8d7da', color: '#721c24' };
    case 'Fixed':
      return { backgroundColor: '#fff3cd', color: '#856404' };
    default:
      return { backgroundColor: '#f1f1f1', color: '#6c757d' };
  }
};

// Цвет иконки папки в зависимости от статуса
const getFolderColor = (status: string) => {
  switch (status) {
    case 'Agreed':
      return '#28a745'; // Green
    case 'Pending':
    case 'Fixed':
      return '#ffc107'; // Yellow
    case 'Issues':
      return '#dc3545'; // Red
    default:
      return '#787878'; // Gray
  }
};

// Общий статус задачи (если хотя бы один baseId не Agreed, то считаем общий статус тем же)
const getTaskStatus = (baseStatuses: BaseStatus[] = []) => {
  const nonAgreedStatus = baseStatuses.find((bs) => bs.status !== 'Agreed');
  return nonAgreedStatus ? nonAgreedStatus.status : 'Agreed';
};

// Определяем количество колонок для colspan в раскрывающейся строке
function getColSpanByRole(role: string) {
  if (role === 'admin') return 7;
  return 5; // executor/initiator
}

// === Компонент строки (одной задачи) ===
function Row({ report, role }: { report: ReportClient; role: string }) {
  const [open, setOpen] = useState(false);

  const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setOpen(!open);
  };

  const getReportDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return !isNaN(date.getTime())
      ? date.toLocaleDateString()
      : 'The date is unavailable';
  };

  {
    // console.log(report.baseStatuses);
  }

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        {/* Стрелка-иконка для раскрытия */}
        <TableCell
          sx={{
            padding: '4px',
          }}
        >
          <IconButton
            aria-label='expand row'
            size='small'
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>

        <TableCell
          align='center'
          sx={{
            padding: '8px',
            textAlign: 'center',
          }}
        >
          <Link
            href='#'
            onClick={handleLinkClick}
            underline='always'
            color='primary'
            sx={{ cursor: 'pointer' }}
          >
            <Typography variant='body2'>{report.reportId}</Typography>
          </Link>
        </TableCell>

        {/* Task */}
        <TableCell
          sx={{
            padding: '4px',
            textAlign: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderIcon
              fontSize='small'
              sx={{ color: getFolderColor(getTaskStatus(report.baseStatuses)) }}
            />
            <Typography variant='body2' sx={{ textAlign: 'left' }}>
              <Link
                href='#'
                onClick={handleLinkClick}
                underline='always'
                color='primary'
                sx={{ cursor: 'pointer' }}
              >
                {report.task}
              </Link>
            </Typography>
          </Box>
        </TableCell>

        {/* Если role=initiator => показываем столбец "Executor" */}
        {role === 'initiator' && (
          <TableCell
            align='center'
            sx={{
              padding: '8px',
              textAlign: 'center',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Typography variant='subtitle2'>{report.executorName}</Typography>
            </Box>
          </TableCell>
        )}

        {/* Если role=executor => показываем столбец "initiator" */}
        {role === 'executor' && (
          <TableCell
            align='center'
            sx={{
              padding: '8px',
              textAlign: 'center',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Typography sx={{ fontSize: '0.9rem' }}>
                {report.initiatorName}
              </Typography>
            </Box>
          </TableCell>
        )}

        {/* Если role=admin => показываем executor + initiator */}
        {role === 'admin' && (
          <>
            <TableCell
              align='center'
              sx={{
                padding: '8px',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Typography sx={{ fontSize: '0.9rem' }}>
                  {report.executorName}
                </Typography>
              </Box>
            </TableCell>
            <TableCell
              align='center'
              sx={{
                padding: '8px',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Avatar
                  alt={report.initiatorName}
                  sx={{ width: 32, height: 32 }}
                >
                  R
                </Avatar>
                <Typography sx={{ fontSize: '0.9rem' }}>
                  {report.initiatorName}
                </Typography>
              </Box>
            </TableCell>
          </>
        )}

        {/* Created */}
        <TableCell
          align='center'
          sx={{
            padding: '8px',
            textAlign: 'center',
          }}
        >
          {getReportDate(report.createdAt)}
        </TableCell>

        {/* Status */}
        <TableCell
          align='center'
          sx={{
            padding: '8px',
          }}
        >
          <Box
            sx={{
              ...getStatusStyles(getTaskStatus(report.baseStatuses)),
              padding: '4px 8px',
              display: 'inline-block',
            }}
          >
            {report.baseStatuses
              .map((bs) => bs.status)
              .filter((value, index, self) => self.indexOf(value) === index)
              .join(' | ')}
          </Box>
        </TableCell>
      </TableRow>

      {/* Доп. информация (раскрывающаяся строка) */}
      <TableRow>
        <TableCell
          style={{ paddingBottom: 0, paddingTop: 0 }}
          colSpan={getColSpanByRole(role)}
        >
          <Collapse in={open} timeout='auto' unmountOnExit>
            <Box sx={{ margin: 1, paddingLeft: 7 }}>
              {report.baseStatuses.map((baseStatus: BaseStatus) => (
                <Box
                  key={baseStatus.baseId}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '4px',
                  }}
                >
                  <FolderIcon
                    fontSize='small'
                    sx={{
                      marginRight: '8px',
                      color: getFolderColor(baseStatus.status),
                    }}
                  />
                  <Typography variant='body2' sx={{ marginRight: '16px' }}>
                    <Link
                      href={`/reports/${report.task}/${baseStatus.baseId}`}
                      underline='always'
                      color='textSecondary'
                    >
                      {baseStatus.baseId}
                    </Link>
                    <Typography
                      component='span'
                      variant='caption'
                      sx={{
                        marginLeft: '8px',
                        color: '#787878',
                      }}
                    >
                      status changed:{' '}
                      {getReportDate(baseStatus.latestStatusChangeDate)}
                    </Typography>
                  </Typography>
                  <Box
                    sx={{
                      ...getStatusStyles(baseStatus.status),
                      padding: '4px 8px',
                      display: 'inline-block',
                      marginLeft: 'auto',
                    }}
                  >
                    {baseStatus.status}
                  </Box>
                </Box>
              ))}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function ReportListPage() {
  const [role, setRole] = useState<string>('');
  const [reports, setReports] = useState<ReportClient[]>([]);
  const [filteredReports, setFilteredReports] = useState<ReportClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Фильтры:
  const [executorFilter, setExecutorFilter] = useState('');
  const [initiatorFilter, setInitiatorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [createdDateRange, setCreatedDateRange] = useState<DateRange<Date>>([
    null,
    null,
  ]);

  // Popover:
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [currentFilter, setCurrentFilter] = useState<string>('');

  // Подсчитываем количество активных фильтров
  const activeFiltersCount = useMemo(() => {
    return [
      executorFilter,
      initiatorFilter,
      statusFilter,
      taskSearch,
      createdDateRange[0] || createdDateRange[1] ? createdDateRange : null,
    ].filter(Boolean).length;
  }, [
    executorFilter,
    initiatorFilter,
    statusFilter,
    taskSearch,
    createdDateRange,
  ]);

  // Получаем уникальных авторовc
  const uniqueExecutors = useMemo(() => {
    const executors = reports.map((report) => report.executorName);
    // console.log('Executors:', executors);
    return Array.from(new Set(executors));
  }, [reports]);

  // Получаем уникальных ревьюеров
  const uniqueInitiators = useMemo(() => {
    const initiators = reports.map((report) => report.initiatorName);
    return Array.from(new Set(initiators));
  }, [reports]);

  // Получаем уникальные статусы
  const uniqueStatuses = useMemo(() => {
    const statuses = reports.flatMap((report) =>
      report.baseStatuses.map((bs) => bs.status)
    );
    return Array.from(new Set(statuses));
  }, [reports]);

  // Загружаем данные
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch('/api/reports');
        const data: ApiResponse & { userRole?: string } = await response.json();

        if (!response.ok) {
          const errorMessage = data.error || 'Unknown error';
          throw new Error(errorMessage);
        }
        if (!Array.isArray(data.reports)) {
          throw new Error('Invalid data format');
        }
        // console.log('Reports:', data.reports);
        // Устанавливаем роль (executor, initiator, admin и т.д.)
        if (data.userRole) {
          setRole(data.userRole);
        }

        // Преобразуем даты в ISO
        const mappedReports = data.reports.map((report: ReportClient) => ({
          ...report,
          baseStatuses: report.baseStatuses.map((bs: BaseStatus) => ({
            ...bs,
            latestStatusChangeDate: new Date(
              bs.latestStatusChangeDate
            ).toISOString(),
          })),
        }));

        setReports(mappedReports);
        setLoading(false);
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('Error fetching reports:', error);
          setError(error.message || 'Unknown error');
        } else {
          console.error('Error fetching reports:', error);
          setError('Unknown error');
        }
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  // Фильтруем отчёты
  useEffect(() => {
    let tempReports = [...reports];

    // Filter by executor
    if (executorFilter) {
      tempReports = tempReports.filter(
        (report) => report.executorName === executorFilter
      );
    }

    // Filter by initiator
    if (initiatorFilter) {
      tempReports = tempReports.filter(
        (report) => report.initiatorName === initiatorFilter
      );
    }

    // Filter by status
    if (statusFilter) {
      tempReports = tempReports.filter((report) =>
        report.baseStatuses.some((bs) => bs.status === statusFilter)
      );
    }

    // Filter by creation date range
    if (createdDateRange[0] && createdDateRange[1]) {
      tempReports = tempReports.filter((report) => {
        const reportDate = new Date(report.createdAt);
        return (
          reportDate >= createdDateRange[0]! &&
          reportDate <= createdDateRange[1]!
        );
      });
    }

    // Search by tasks
    if (taskSearch) {
      tempReports = tempReports.filter((report) =>
        report.task.toLowerCase().includes(taskSearch.toLowerCase())
      );
    }

    setFilteredReports(tempReports);
  }, [
    reports,
    executorFilter,
    initiatorFilter,
    statusFilter,
    createdDateRange,
    taskSearch,
  ]);

  // Popover handlers
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

  const openPopover = Boolean(anchorEl);
  const popoverId = openPopover ? 'filter-popover' : undefined;

  if (loading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color='error' align='center' sx={{ marginTop: '20px' }}>
        {error}
      </Typography>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box
        sx={{
          width: '100%',
        }}
      >
        {/* Блок "Active filters" */}
        {activeFiltersCount > 0 && (
          <Box sx={{ padding: 2, marginBottom: 2 }}>
            <Typography variant='subtitle1' sx={{ mb: 1 }}>
              Active filters
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {executorFilter && (
                <Chip
                  label={`Executor: ${executorFilter}`}
                  onDelete={() => setExecutorFilter('')}
                  color='primary'
                  size='small'
                />
              )}
              {initiatorFilter && (
                <Chip
                  label={`Initiator: ${initiatorFilter}`}
                  onDelete={() => setInitiatorFilter('')}
                  color='primary'
                  size='small'
                />
              )}
              {statusFilter && (
                <Chip
                  label={`Status: ${statusFilter}`}
                  onDelete={() => setStatusFilter('')}
                  color='primary'
                  size='small'
                />
              )}
              {taskSearch && (
                <Chip
                  label={`Task: ${taskSearch}`}
                  onDelete={() => setTaskSearch('')}
                  color='primary'
                  size='small'
                />
              )}
              {createdDateRange[0] && createdDateRange[1] && (
                <Chip
                  label={`Created: ${createdDateRange[0].toLocaleDateString()} - ${createdDateRange[1].toLocaleDateString()}`}
                  onDelete={() => setCreatedDateRange([null, null])}
                  color='primary'
                  size='small'
                />
              )}
            </Box>
            <Grid container spacing={2} alignItems='center'>
              <Grid item xs={12} sm={6} md={3}>
                <Button
                  onClick={() => {
                    setExecutorFilter('');
                    setInitiatorFilter('');
                    setStatusFilter('');
                    setTaskSearch('');
                    setCreatedDateRange([null, null]);
                  }}
                >
                  Delete All
                </Button>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Таблица */}
        <TableContainer component={Box}>
          <Table aria-label='collapsible table'>
            <TableHead>
              <TableRow>
                {/* 1) Пустая ячейка (стрелка) */}
                <TableCell />

                {/* 2) ID */}
                <TableCell
                  align='center'
                  sx={{
                    whiteSpace: 'nowrap',
                    padding: '16px',
                  }}
                >
                  <strong>ID</strong>
                </TableCell>

                {/* 3) Task */}
                <TableCell
                  align='center'
                  sx={{
                    whiteSpace: 'nowrap',
                    padding: '16px',
                  }}
                >
                  <strong>Report</strong>
                  <Tooltip title='Report Find'>
                    <IconButton
                      size='small'
                      onClick={(event) => handleFilterClick(event, 'task')}
                      color={taskSearch ? 'primary' : 'default'}
                      aria-label='Report filter'
                      aria-controls={
                        openPopover && currentFilter === 'task'
                          ? 'filter-popover'
                          : undefined
                      }
                      aria-haspopup='true'
                      sx={{ mr: 1 }}
                    >
                      <SearchIcon fontSize='medium' />
                    </IconButton>
                  </Tooltip>
                </TableCell>

                {/* Если initiator → столбец executor */}
                {role === 'initiator' && (
                  <TableCell
                    align='center'
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                    }}
                  >
                    <strong>Executor</strong>
                    <Tooltip title='Executor filter'>
                      <IconButton
                        size='small'
                        onClick={(event) =>
                          handleFilterClick(event, 'executor')
                        }
                        color={executorFilter ? 'primary' : 'default'}
                        aria-label='Executor filter'
                        aria-controls={
                          openPopover && currentFilter === 'executor'
                            ? 'filter-popover'
                            : undefined
                        }
                        aria-haspopup='true'
                      >
                        <FilterListIcon fontSize='small' />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}

                {/* Если executor → столбец initiator */}
                {role === 'executor' && (
                  <TableCell
                    align='center'
                    sx={{
                      whiteSpace: 'nowrap',
                      padding: '16px',
                    }}
                  >
                    <strong>Initiator</strong>
                    {/* Иконка для фильтра initiator */}
                    <Tooltip title='initiator filter'>
                      <IconButton
                        size='small'
                        onClick={(event) =>
                          handleFilterClick(event, 'initiator')
                        }
                        color={initiatorFilter ? 'primary' : 'default'}
                        aria-label='initiator filter'
                        aria-controls={
                          openPopover && currentFilter === 'initiator'
                            ? 'filter-popover'
                            : undefined
                        }
                        aria-haspopup='true'
                      >
                        <FilterListIcon fontSize='small' />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}

                {/* Если admin → столбцы executor + initiator */}
                {role === 'admin' && (
                  <>
                    <TableCell
                      align='center'
                      sx={{
                        whiteSpace: 'nowrap',
                        padding: '16px',
                      }}
                    >
                      <strong>Executor</strong>
                      <Tooltip title='Executor filter'>
                        <IconButton
                          size='small'
                          onClick={(event) =>
                            handleFilterClick(event, 'executor')
                          }
                          color={executorFilter ? 'primary' : 'default'}
                          aria-label='Executor filter'
                          aria-controls={
                            openPopover && currentFilter === 'executor'
                              ? 'filter-popover'
                              : undefined
                          }
                          aria-haspopup='true'
                        >
                          <FilterListIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      align='center'
                      sx={{
                        whiteSpace: 'nowrap',
                        padding: '16px',
                      }}
                    >
                      <strong>Initiator</strong>
                      <Tooltip title='initiator filter'>
                        <IconButton
                          size='small'
                          onClick={(event) =>
                            handleFilterClick(event, 'initiator')
                          }
                          color={initiatorFilter ? 'primary' : 'default'}
                          aria-label='initiator filter'
                          aria-controls={
                            openPopover && currentFilter === 'initiator'
                              ? 'filter-popover'
                              : undefined
                          }
                          aria-haspopup='true'
                        >
                          <FilterListIcon fontSize='small' />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </>
                )}

                {/* Created */}
                <TableCell
                  align='center'
                  sx={{
                    whiteSpace: 'nowrap',
                    padding: '16px',
                  }}
                >
                  <strong>Created</strong>
                  <Tooltip title='Filter by creation date'>
                    <IconButton
                      size='small'
                      onClick={(event) => handleFilterClick(event, 'createdAt')}
                      color={
                        createdDateRange[0] || createdDateRange[1]
                          ? 'primary'
                          : 'default'
                      }
                      aria-label='Filter by creation date'
                      aria-controls={
                        openPopover && currentFilter === 'createdAt'
                          ? 'filter-popover'
                          : undefined
                      }
                      aria-haspopup='true'
                    >
                      <FilterListIcon fontSize='small' />
                    </IconButton>
                  </Tooltip>
                </TableCell>

                {/* Status */}
                <TableCell
                  align='center'
                  sx={{
                    whiteSpace: 'nowrap',
                    padding: '16px',
                  }}
                >
                  <strong>Status</strong>
                  <Tooltip title='Filter by Status'>
                    <IconButton
                      size='small'
                      onClick={(event) => handleFilterClick(event, 'status')}
                      color={statusFilter ? 'primary' : 'default'}
                      aria-label='Filter by Status'
                      aria-controls={
                        openPopover && currentFilter === 'status'
                          ? 'filter-popover'
                          : undefined
                      }
                      aria-haspopup='true'
                    >
                      <FilterListIcon fontSize='small' />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {filteredReports.length > 0 ? (
                filteredReports.map((report: ReportClient) => (
                  <Row key={report.reportId} report={report} role={role} />
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={getColSpanByRole(role)} align='center'>
                    There are no reports that meet the specified conditions.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Popover для фильтров */}
        <Popover
          id={popoverId}
          open={openPopover}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          <Box sx={{ p: 1.5, minWidth: 200, boxShadow: 3, borderRadius: 1 }}>
            {currentFilter === 'task' && (
              <TextField
                label='Search by Tasks'
                variant='outlined'
                size='small'
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                fullWidth
                autoFocus
                sx={{
                  '& .MuiInputLabel-root': { fontSize: '0.75rem' },
                  '& .MuiInputBase-input': { fontSize: '0.75rem' },
                }}
              />
            )}

            {currentFilter === 'executor' && (
              <FormControl fullWidth variant='outlined' size='small'>
                <InputLabel
                  id='executor-filter-label'
                  sx={{ fontSize: '0.75rem' }}
                >
                  Executor
                </InputLabel>
                <Select
                  labelId='executor-filter-label'
                  value={executorFilter}
                  label='Executor'
                  onChange={(e) => setExecutorFilter(e.target.value)}
                  autoFocus
                  sx={{
                    '& .MuiSelect-select': { fontSize: '0.75rem' },
                    '& .MuiInputLabel-root': { fontSize: '0.75rem' },
                  }}
                >
                  <MenuItem value=''>
                    <em>All</em>
                  </MenuItem>
                  {uniqueExecutors.map((executor) => (
                    <MenuItem key={uuidv4()} value={executor}>
                      {executor}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {currentFilter === 'initiator' && (
              <FormControl fullWidth variant='outlined' size='small'>
                <InputLabel
                  id='initiator-filter-label'
                  sx={{ fontSize: '0.75rem' }}
                >
                  Initiator
                </InputLabel>
                <Select
                  labelId='initiator-filter-label'
                  value={initiatorFilter}
                  label='Initiator'
                  onChange={(e) => setInitiatorFilter(e.target.value)}
                  autoFocus
                  sx={{
                    '& .MuiSelect-select': { fontSize: '0.75rem' },
                    '& .MuiInputLabel-root': { fontSize: '0.75rem' },
                  }}
                >
                  <MenuItem value=''>
                    <em>All</em>
                  </MenuItem>
                  {uniqueInitiators.map((initiator) => (
                    <MenuItem key={initiator} value={initiator}>
                      {initiator}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {currentFilter === 'status' && (
              <FormControl fullWidth variant='outlined' size='small'>
                <InputLabel
                  id='status-filter-label'
                  sx={{ fontSize: '0.75rem' }}
                >
                  Status
                </InputLabel>
                <Select
                  labelId='status-filter-label'
                  value={statusFilter}
                  label='Status'
                  onChange={(e) => setStatusFilter(e.target.value)}
                  autoFocus
                  sx={{
                    '& .MuiSelect-select': { fontSize: '0.75rem' },
                    '& .MuiInputLabel-root': { fontSize: '0.75rem' },
                  }}
                >
                  <MenuItem value=''>
                    <em>All</em>
                  </MenuItem>
                  {uniqueStatuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {currentFilter === 'createdAt' && (
              <DateRangePicker
                value={createdDateRange}
                onChange={(newValue) => setCreatedDateRange(newValue)}
                slots={{ field: SingleInputDateRangeField }}
              />
            )}

            {/* Кнопки "Close" и "Delete" (сброс) */}
            <Box
              sx={{ mt: 1, display: 'flex', justifyContent: 'space-between' }}
            >
              <Button
                variant='contained'
                size='small'
                onClick={handleClose}
                sx={{ fontSize: '0.8rem' }}
              >
                Close
              </Button>
              <Button
                variant='text'
                size='small'
                onClick={() => {
                  if (currentFilter === 'task') setTaskSearch('');
                  if (currentFilter === 'executor') setExecutorFilter('');
                  if (currentFilter === 'initiator') setInitiatorFilter('');
                  if (currentFilter === 'status') setStatusFilter('');
                  if (currentFilter === 'createdAt')
                    setCreatedDateRange([null, null]);
                }}
                sx={{ fontSize: '0.8rem' }}
              >
                Delete
              </Button>
            </Box>
          </Box>
        </Popover>
      </Box>
    </LocalizationProvider>
  );
}

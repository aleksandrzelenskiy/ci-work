'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Paper,
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
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
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
  // Считаем столбцы:
  // 1. Arrow (иконка раскрытия)
  // 2. Task
  // 3. (Author/Reviwer/оба) - от 1 до 2 столбцов
  // 4. Created
  // 5. Status
  //
  // Если role = 'author' или 'reviewer', у нас 1 столбец (либо Author, либо Reviewer) => итого 5.
  // Если role = 'admin', у нас 2 столбца (Author + Reviewer) => итого 6.
  if (role === 'admin') return 6;
  return 5; // author/reviewer
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

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        {/* Стрелка-иконка для раскрытия */}
        <TableCell
          sx={{
            padding: '4px', // Уменьшенный padding
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

        {/* Task */}
        <TableCell
          sx={{
            padding: '4px', // Уменьшенный padding
            textAlign: 'center', // Центрирование содержимого
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderIcon
              fontSize='small'
              sx={{ color: getFolderColor(getTaskStatus(report.baseStatuses)) }}
            />
            <Typography>
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

        {/* Если role=reviewer => показываем столбец "Author" */}
        {role === 'reviewer' && (
          <TableCell
            align='center' // Уже выровнено по центру
            sx={{
              padding: '8px', // Можно оставить стандартный padding или немного уменьшить
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar
                alt={report.userName}
                src={report.userAvatar}
                sx={{ width: 32, height: 32 }}
              />
              <Typography sx={{ fontSize: '0.9rem' }}>
                {report.userName}
              </Typography>
            </Box>
          </TableCell>
        )}

        {/* Если role=author => показываем столбец "Reviewer" */}
        {role === 'author' && (
          <TableCell
            align='center' // Уже выровнено по центру
            sx={{
              padding: '8px', // Можно оставить стандартный padding или немного уменьшить
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Avatar alt={report.reviewerName} sx={{ width: 32, height: 32 }}>
                R
              </Avatar>
              <Typography sx={{ fontSize: '0.9rem' }}>
                {report.reviewerName}
              </Typography>
            </Box>
          </TableCell>
        )}

        {/* Если role=admin => показываем Author + Reviewer */}
        {role === 'admin' && (
          <>
            <TableCell
              align='center' // Уже выровнено по центру
              sx={{
                padding: '8px', // Можно оставить стандартный padding или немного уменьшить
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Avatar
                  alt={report.userName}
                  src={report.userAvatar}
                  sx={{ width: 32, height: 32 }}
                />
                <Typography sx={{ fontSize: '0.9rem' }}>
                  {report.userName}
                </Typography>
              </Box>
            </TableCell>
            <TableCell
              align='center' // Уже выровнено по центру
              sx={{
                padding: '8px', // Можно оставить стандартный padding или немного уменьшить
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Avatar
                  alt={report.reviewerName}
                  sx={{ width: 32, height: 32 }}
                >
                  R
                </Avatar>
                <Typography sx={{ fontSize: '0.9rem' }}>
                  {report.reviewerName}
                </Typography>
              </Box>
            </TableCell>
          </>
        )}

        {/* Created */}
        <TableCell
          align='center' // Уже выровнено по центру
          sx={{
            padding: '8px', // Можно оставить стандартный padding или немного уменьшить
          }}
        >
          {getReportDate(report.createdAt)}
        </TableCell>

        {/* Status */}
        <TableCell
          align='center' // Уже выровнено по центру
          sx={{
            padding: '8px', // Можно оставить стандартный padding или немного уменьшить
          }}
        >
          <Box
            sx={{
              ...getStatusStyles(getTaskStatus(report.baseStatuses)),
              padding: '4px 8px',
              display: 'inline-block',
            }}
          >
            {getTaskStatus(report.baseStatuses)}
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

export default function ReportsPage() {
  const [role, setRole] = useState<string>(''); // храним роль текущего пользователя
  const [reports, setReports] = useState<ReportClient[]>([]);
  const [filteredReports, setFilteredReports] = useState<ReportClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Фильтры:
  const [authorFilter, setAuthorFilter] = useState('');
  const [reviewerFilter, setReviewerFilter] = useState(''); // <-- НОВЫЙ фильтр по reviewer
  const [statusFilter, setStatusFilter] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [createdAtFilter, setCreatedAtFilter] = useState<Date | null>(null);

  // Popover:
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [currentFilter, setCurrentFilter] = useState<string>('');

  // Подсчитываем количество активных фильтров
  const activeFiltersCount = useMemo(() => {
    // Добавили reviewerFilter в массив
    return [
      authorFilter,
      reviewerFilter,
      statusFilter,
      taskSearch,
      createdAtFilter,
    ].filter(Boolean).length;
  }, [authorFilter, reviewerFilter, statusFilter, taskSearch, createdAtFilter]);

  // Получаем уникальных авторов
  const uniqueAuthors = useMemo(() => {
    const authors = reports.map((report) => report.userName);
    return Array.from(new Set(authors));
  }, [reports]);

  // Получаем уникальных ревьюеров
  const uniqueReviewers = useMemo(() => {
    const reviewers = reports.map((report) => report.reviewerName);
    return Array.from(new Set(reviewers));
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
        // userRole - мы возвращаем с сервера
        const data: ApiResponse & { userRole?: string } = await response.json();

        if (!response.ok) {
          const errorMessage = data.error || 'Unknown error';
          throw new Error(errorMessage);
        }
        if (!Array.isArray(data.reports)) {
          throw new Error('Invalid data format');
        }

        // Устанавливаем роль (author, reviewer, admin и т.д.)
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

    // Filter by author
    if (authorFilter) {
      tempReports = tempReports.filter(
        (report) => report.userName === authorFilter
      );
    }

    // Filter by reviewer
    if (reviewerFilter) {
      tempReports = tempReports.filter(
        (report) => report.reviewerName === reviewerFilter
      );
    }

    // Filter by status
    if (statusFilter) {
      tempReports = tempReports.filter((report) =>
        report.baseStatuses.some((bs) => bs.status === statusFilter)
      );
    }

    // Filter by creation date
    if (createdAtFilter) {
      const selectedDate = new Date(createdAtFilter).setHours(0, 0, 0, 0);
      tempReports = tempReports.filter((report) => {
        const reportDate = new Date(report.createdAt).setHours(0, 0, 0, 0);
        return reportDate === selectedDate;
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
    authorFilter,
    reviewerFilter,
    statusFilter,
    createdAtFilter,
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
    <Box
      sx={{
        position: 'relative',
        left: '50%',
        right: '50%',
        marginLeft: '-49vw',
        marginRight: '-49vw',
        width: '98vw',
      }}
    >
      {/* Блок "Active filters" */}
      {activeFiltersCount > 0 && (
        <Paper sx={{ padding: 2, marginBottom: 2 }}>
          <Typography variant='subtitle1' sx={{ mb: 1 }}>
            Active filters
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {authorFilter && (
              <Chip
                label={`Author: ${authorFilter}`}
                onDelete={() => setAuthorFilter('')}
                color='primary'
                size='small'
              />
            )}
            {reviewerFilter && (
              <Chip
                label={`Reviewer: ${reviewerFilter}`}
                onDelete={() => setReviewerFilter('')}
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
            {createdAtFilter && (
              <Chip
                label={`Created: ${createdAtFilter.toLocaleDateString()}`}
                onDelete={() => setCreatedAtFilter(null)}
                color='primary'
                size='small'
              />
            )}
          </Box>
          <Grid container spacing={2} alignItems='center'>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                onClick={() => {
                  setAuthorFilter('');
                  setReviewerFilter('');
                  setStatusFilter('');
                  setTaskSearch('');
                  setCreatedAtFilter(null);
                }}
              >
                Delete All
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Таблица */}
      <TableContainer component={Paper}>
        <Table aria-label='collapsible table'>
          <TableHead>
            <TableRow>
              {/* 1) Пустая ячейка (стрелка) */}
              <TableCell />

              {/* 2) Task */}
              <TableCell
                align='left'
                sx={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  padding: '16px',
                }}
              >
                Task
                <Tooltip title='Task Find'>
                  <IconButton
                    size='small'
                    onClick={(event) => handleFilterClick(event, 'task')}
                    color={taskSearch ? 'primary' : 'default'}
                    aria-label='Task filter'
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

              {/* Если reviewer → столбец Author */}
              {role === 'reviewer' && (
                <TableCell
                  align='center'
                  sx={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    padding: '16px',
                  }}
                >
                  Author
                  <Tooltip title='Author filter'>
                    <IconButton
                      size='small'
                      onClick={(event) => handleFilterClick(event, 'author')}
                      color={authorFilter ? 'primary' : 'default'}
                      aria-label='Author filter'
                      aria-controls={
                        openPopover && currentFilter === 'author'
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

              {/* Если author → столбец Reviewer */}
              {role === 'author' && (
                <TableCell
                  align='center'
                  sx={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    padding: '16px',
                  }}
                >
                  Reviewer
                  {/* Иконка для фильтра Reviewer */}
                  <Tooltip title='Reviewer filter'>
                    <IconButton
                      size='small'
                      onClick={(event) => handleFilterClick(event, 'reviewer')}
                      color={reviewerFilter ? 'primary' : 'default'}
                      aria-label='Reviewer filter'
                      aria-controls={
                        openPopover && currentFilter === 'reviewer'
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

              {/* Если admin → столбцы Author + Reviewer */}
              {role === 'admin' && (
                <>
                  <TableCell
                    align='center'
                    sx={{
                      fontSize: '14px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      padding: '16px',
                    }}
                  >
                    Author
                    <Tooltip title='Author filter'>
                      <IconButton
                        size='small'
                        onClick={(event) => handleFilterClick(event, 'author')}
                        color={authorFilter ? 'primary' : 'default'}
                        aria-label='Author filter'
                        aria-controls={
                          openPopover && currentFilter === 'author'
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
                      fontSize: '14px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      padding: '16px',
                    }}
                  >
                    Reviewer
                    <Tooltip title='Reviewer filter'>
                      <IconButton
                        size='small'
                        onClick={(event) =>
                          handleFilterClick(event, 'reviewer')
                        }
                        color={reviewerFilter ? 'primary' : 'default'}
                        aria-label='Reviewer filter'
                        aria-controls={
                          openPopover && currentFilter === 'reviewer'
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
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  padding: '16px',
                }}
              >
                Created
                <Tooltip title='Filter by creation date'>
                  <IconButton
                    size='small'
                    onClick={(event) => handleFilterClick(event, 'createdAt')}
                    color={createdAtFilter ? 'primary' : 'default'}
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
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  padding: '16px',
                }}
              >
                Status
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
                <Row key={report._id} report={report} role={role} />
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

          {currentFilter === 'author' && (
            <FormControl fullWidth variant='outlined' size='small'>
              <InputLabel id='author-filter-label' sx={{ fontSize: '0.75rem' }}>
                Author
              </InputLabel>
              <Select
                labelId='author-filter-label'
                value={authorFilter}
                label='Author'
                onChange={(e) => setAuthorFilter(e.target.value)}
                autoFocus
                sx={{
                  '& .MuiSelect-select': { fontSize: '0.75rem' },
                  '& .MuiInputLabel-root': { fontSize: '0.75rem' },
                }}
              >
                <MenuItem value=''>
                  <em>All</em>
                </MenuItem>
                {uniqueAuthors.map((author) => (
                  <MenuItem key={author} value={author}>
                    {author}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {currentFilter === 'reviewer' && (
            <FormControl fullWidth variant='outlined' size='small'>
              <InputLabel
                id='reviewer-filter-label'
                sx={{ fontSize: '0.75rem' }}
              >
                Reviewer
              </InputLabel>
              <Select
                labelId='reviewer-filter-label'
                value={reviewerFilter}
                label='Reviewer'
                onChange={(e) => setReviewerFilter(e.target.value)}
                autoFocus
                sx={{
                  '& .MuiSelect-select': { fontSize: '0.75rem' },
                  '& .MuiInputLabel-root': { fontSize: '0.75rem' },
                }}
              >
                <MenuItem value=''>
                  <em>All</em>
                </MenuItem>
                {uniqueReviewers.map((rev) => (
                  <MenuItem key={rev} value={rev}>
                    {rev}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {currentFilter === 'status' && (
            <FormControl fullWidth variant='outlined' size='small'>
              <InputLabel id='status-filter-label' sx={{ fontSize: '0.75rem' }}>
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
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label='Created'
                value={createdAtFilter}
                onChange={(newValue: Date | null) =>
                  setCreatedAtFilter(newValue)
                }
                slots={{ textField: TextField }}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    autoFocus: true,
                    sx: {
                      '& .MuiInputLabel-root': { fontSize: '0.9rem' },
                      '& .MuiInputBase-input': { fontSize: '0.9rem' },
                    },
                  },
                }}
              />
            </LocalizationProvider>
          )}

          {/* Кнопки "Close" и "Delete" (сброс) */}
          <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between' }}>
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
                if (currentFilter === 'author') setAuthorFilter('');
                if (currentFilter === 'reviewer') setReviewerFilter('');
                if (currentFilter === 'status') setStatusFilter('');
                if (currentFilter === 'createdAt') setCreatedAtFilter(null);
              }}
              sx={{ fontSize: '0.8rem' }}
            >
              Delete
            </Button>
          </Box>
        </Box>
      </Popover>
    </Box>
  );
}

// /app/reports/page.tsx

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

// Function to determine status styles
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

// Function to determine folder icon color
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
      return '#787878'; // Default gray
  }
};

// Function to calculate the overall task status
const getTaskStatus = (baseStatuses: BaseStatus[] = []): string => {
  const nonAgreedStatus = baseStatuses.find((bs) => bs.status !== 'Agreed');
  return nonAgreedStatus ? nonAgreedStatus.status : 'Agreed';
};

// Report row component
function Row({ report }: { report: ReportClient }) {
  const [open, setOpen] = useState(false);

  // Function to handle link click
  const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setOpen(!open);
  };

  // Function to get report date
  const getReportDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return !isNaN(date.getTime())
      ? date.toLocaleDateString()
      : 'The date is unavailable';
  };

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            aria-label='expand row'
            size='small'
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
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
        <TableCell>
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
        <TableCell>{getReportDate(report.createdAt)}</TableCell>
        <TableCell>
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
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
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

// Main component for the reports page
export default function ReportsPage() {
  const [reports, setReports] = useState<ReportClient[]>([]);
  const [filteredReports, setFilteredReports] = useState<ReportClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States for filters and search
  const [authorFilter, setAuthorFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [taskSearch, setTaskSearch] = useState<string>('');
  const [createdAtFilter, setCreatedAtFilter] = useState<Date | null>(null);

  // States for filter popover
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [currentFilter, setCurrentFilter] = useState<string>('');

  // Determine the number of active filters
  const activeFiltersCount = useMemo(() => {
    return [authorFilter, statusFilter, taskSearch, createdAtFilter].filter(
      Boolean
    ).length;
  }, [authorFilter, statusFilter, taskSearch, createdAtFilter]);

  // Get unique authors and statuses for filters
  const uniqueAuthors = useMemo(() => {
    const authors = reports.map((report) => report.userName);
    return Array.from(new Set(authors));
  }, [reports]);

  const uniqueStatuses = useMemo(() => {
    const statuses = reports.flatMap((report) =>
      report.baseStatuses.map((bs) => bs.status)
    );
    return Array.from(new Set(statuses));
  }, [reports]);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch('/api/reports');
        const data: ApiResponse = await response.json();

        // console.log('Fetched data:', data);

        if (!response.ok) {
          const errorMessage = data.error || 'Unknown error';
          throw new Error(errorMessage);
        }

        if (!Array.isArray(data.reports)) {
          throw new Error('Invalid data format');
        }

        setReports(
          data.reports.map((report: ReportClient) => ({
            ...report,
            baseStatuses: report.baseStatuses.map((bs: BaseStatus) => ({
              ...bs,
              latestStatusChangeDate: new Date(
                bs.latestStatusChangeDate
              ).toISOString(),
            })),
          }))
        );
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

  // Function to filter reports
  useEffect(() => {
    let tempReports = [...reports];

    // Filter by author
    if (authorFilter) {
      tempReports = tempReports.filter(
        (report) => report.userName === authorFilter
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
  }, [reports, authorFilter, statusFilter, createdAtFilter, taskSearch]);

  if (loading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}
      >
        <CircularProgress />
      </div>
    );
  }

  if (error) {
    return (
      <Typography color='error' align='center' sx={{ marginTop: '20px' }}>
        {error}
      </Typography>
    );
  }

  // Handlers for filter popover
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

  return (
    <Box sx={{ padding: 2 }}>
      {/* Conditional display of filters block */}
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

      {/* Reports table */}
      <TableContainer component={Paper}>
        <Table aria-label='collapsible table'>
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
                <Row key={report._id} report={report} />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} align='center'>
                  There are no reports that meet the specified conditions.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Filter popover */}
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
          {/* Buttons for closing and resetting filter */}
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

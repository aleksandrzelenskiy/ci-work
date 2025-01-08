'use client';

import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

interface BaseStatus {
  baseId: string;
  status: string;
}

interface Report {
  _id: string;
  task: string;
  userName: string;
  userAvatar: string;
  createdAt: string; // Дата на уровне отчета
  baseStatuses: BaseStatus[];
}

// Функция для определения стилей статуса
const getStatusStyles = (status: string) => {
  switch (status) {
    case 'Agreed':
      return { backgroundColor: '#d4edda', color: '#155724' };
    case 'Pending':
      return { backgroundColor: '#fff3cd', color: '#856404' };
    case 'Issues':
      return { backgroundColor: '#f8d7da', color: '#721c24' };
    case 'ReCheck':
      return { backgroundColor: '#fff3cd', color: '#856404' };
    default:
      return { backgroundColor: '#f1f1f1', color: '#6c757d' };
  }
};

// Функция для вычисления общего статуса задачи
const getTaskStatus = (baseStatuses: BaseStatus[] = []): string => {
  const nonAgreedStatus = baseStatuses.find((bs) => bs.status !== 'Agreed');
  return nonAgreedStatus ? nonAgreedStatus.status : 'Agreed';
};

// Компонент строки отчёта
function Row({ report }: { report: Report }) {
  const [open, setOpen] = useState(false);

  // Функция для обработки клика по ссылке
  const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault(); // Предотвращаем переход по ссылке
    setOpen(!open); // Переключаем состояние открытия
  };

  // Функция для получения даты отчета
  const getReportDate = (createdAt: string) => {
    const date = new Date(createdAt);
    return !isNaN(date.getTime())
      ? date.toLocaleDateString()
      : 'Дата недоступна';
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
            <FolderIcon fontSize='small' sx={{ color: '#28a0e9' }} />
            <Typography>
              <a
                href='#'
                onClick={handleLinkClick}
                style={{
                  textDecoration: 'underline',
                  color: '#28a0e9',
                  cursor: 'pointer',
                }}
              >
                {report.task}
              </a>
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
            <Typography>{report.userName}</Typography>
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
              {report.baseStatuses.map((baseStatus) => (
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
                    sx={{ marginRight: '8px', color: '#787878' }}
                  />
                  <Typography variant='body2' sx={{ marginRight: '16px' }}>
                    <a
                      href={`/reports/${report.task}/${baseStatus.baseId}`}
                      style={{ textDecoration: 'underline', color: '#787878' }}
                    >
                      {baseStatus.baseId}
                    </a>
                    <Typography
                      variant='caption'
                      sx={{
                        marginLeft: '8px',
                        color: '#787878',
                      }}
                    >
                      {getReportDate(report.createdAt)}
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

// Основной компонент для страницы отчётов
export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch('/api/reports');
        const data = await response.json();

        setReports(
          data.map((report: { baseStatuses: unknown }) => ({
            ...report,
            baseStatuses: report.baseStatuses || [],
          }))
        );
        setLoading(false);
      } catch (error) {
        console.error('Error fetching reports:', error);
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  if (loading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}
      >
        <CircularProgress />
      </div>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table aria-label='collapsible table'>
        <TableHead>
          <TableRow>
            <TableCell />
            <TableCell>Task</TableCell>
            <TableCell>Author</TableCell>
            <TableCell>Created At</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {reports.map((report) => (
            <Row key={report._id} report={report} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

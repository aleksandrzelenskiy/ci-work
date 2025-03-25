// app/components/dashboards/MiniReportsList.tsx

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Chip,
} from '@mui/material';
import Link from 'next/link';
import CloseIcon from '@mui/icons-material/Close';
import FolderIcon from '@mui/icons-material/Folder';

import { getStatusColor } from '@/utils/statusColors';
import { BaseStatus, ReportClient, ApiResponse } from '@/app/types/reportTypes';

interface MiniReportsListProps {
  role: string; // 'admin' | 'author' | 'initiator' | 'executor'
  clerkUserId: string; // текущий userId (из Clerk)
}

// Простая функция, определяющая «общий» статус отчёта
function getTaskStatus(baseStatuses: BaseStatus[] = []): string {
  const notAgreed = baseStatuses.find((bs) => bs.status !== 'Agreed');
  return notAgreed ? notAgreed.status : 'Agreed';
}

export default function MiniReportsList({
  role,
  clerkUserId,
}: MiniReportsListProps) {
  const [reports, setReports] = useState<ReportClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Диалоговое окно
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportClient | null>(
    null
  );

  // 1) Загружаем /api/reports
  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await fetch('/api/reports');
        if (!res.ok) {
          throw new Error('Failed to fetch reports');
        }
        // Ожидаем формат ApiResponse { reports: ReportClient[], error?: string }
        const data: ApiResponse = await res.json();
        setReports(data.reports);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Unknown error');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  // 2) Фильтрация по роли
  const filteredReports = useMemo(() => {
    if (role === 'admin' || role === 'manager') {
      // Админ и Менеджер видит все отчеты
      return reports;
    } else if (role === 'author') {
      // Author видит те, где report.authorId === clerkUserId
      return reports.filter((rep) => rep.authorId === clerkUserId);
    } else if (role === 'initiator') {
      // Initiator видит те, где initiatorId === clerkUserId
      return reports.filter((rep) => rep.initiatorId === clerkUserId);
    } else if (role === 'executor') {
      // Executor видит те, где executorId === clerkUserId
      return reports.filter((rep) => rep.executorId === clerkUserId);
    }
    // Если какая-то иная роль – можно вернуть []
    return [];
  }, [role, clerkUserId, reports]);

  // 3) Сортируем по createdAt (самые свежие – сверху)
  const sortedReports = useMemo(() => {
    return [...filteredReports].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [filteredReports]);

  // 4) Берём первые 5
  const lastFive = sortedReports.slice(0, 5);

  if (loading) {
    return (
      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        height='200px'
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color='error' textAlign='center' mt={2}>
        {error}
      </Typography>
    );
  }

  if (lastFive.length === 0) {
    return (
      <Typography textAlign='center' mt={2}>
        No reports found
      </Typography>
    );
  }

  // Открытие диалога
  const handleOpenDialog = (report: ReportClient) => {
    setSelectedReport(report);
    setOpenDialog(true);
  };

  // Закрытие диалога
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedReport(null);
  };

  return (
    <>
      <Box>
        {/* Таблица (в "окне" высотой ~4-5 строк) */}
        <Box
          sx={{
            position: 'relative',
            maxHeight: 210,
            overflow: 'hidden',
            mb: 2,
          }}
        >
          <TableContainer component={Paper} sx={{ maxHeight: 210 }}>
            <Table size='small' stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Report</TableCell>

                  <TableCell>Author</TableCell>
                  <TableCell>Created</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lastFive.map((report) => {
                  const status = getTaskStatus(report.baseStatuses || []);
                  return (
                    <TableRow key={report.reportId}>
                      <TableCell>
                        {/* Клик по названию отчёта -> открываем диалог */}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            cursor: 'pointer',
                          }}
                          onClick={() => handleOpenDialog(report)}
                        >
                          <FolderIcon
                            fontSize='small'
                            sx={{ color: getStatusColor(status) }}
                          />
                          {report.task || report.reportId}
                        </Box>
                      </TableCell>

                      <TableCell>{report.executorName}</TableCell>
                      <TableCell>
                        {new Date(report.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Градиент, чтобы обрезать 5ю строку */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 40,
              background: 'linear-gradient(rgba(255,255,255,0), #fff 80%)',
              pointerEvents: 'none',
            }}
          />
        </Box>

        {/* Кнопка All Reports */}
        <Box sx={{ textAlign: 'center' }}>
          <Link href='/reports'>
            <Button variant='text'>All Reports</Button>
          </Link>
        </Box>
      </Box>

      {/* Диалог с базовыми станциями */}
      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        maxWidth='xs'
        fullWidth
      >
        {selectedReport && (
          <>
            <DialogTitle
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Box>
                <Typography variant='subtitle1' sx={{ fontWeight: 'bold' }}>
                  {'View the report on "' +
                    selectedReport.task +
                    '" at the base station:'}
                </Typography>
              </Box>
              <IconButton onClick={handleCloseDialog}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>

            <DialogContent dividers>
              <Typography variant='subtitle2' sx={{ mb: 1 }}>
                Created:{' '}
                {new Date(selectedReport.createdAt).toLocaleDateString()}
              </Typography>

              {/* Список всех базовых станций */}
              <List dense>
                {(selectedReport.baseStatuses || []).map((base) => {
                  const color = getStatusColor(base.status);
                  return (
                    <ListItemButton
                      key={base.baseId}
                      component={Link}
                      href={`/reports/${selectedReport.task}/${base.baseId}`}
                    >
                      <ListItemIcon>
                        <FolderIcon sx={{ color }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                            }}
                          >
                            <Typography>{base.baseId}</Typography>
                            <Chip
                              label={base.status}
                              sx={{
                                backgroundColor: color,
                                color: '#fff',
                                textTransform: 'capitalize',
                              }}
                              size='small'
                            />
                          </Box>
                        }
                        secondary={
                          'Status changed: ' +
                          new Date(
                            base.latestStatusChangeDate
                          ).toLocaleDateString()
                        }
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </DialogContent>

            <DialogActions>
              <Button onClick={handleCloseDialog}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  );
}

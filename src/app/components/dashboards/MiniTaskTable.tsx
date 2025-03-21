// app/components/dashboards/MiniTaskTable.tsx

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
  Chip,
  Tooltip,
} from '@mui/material';
import Link from 'next/link';

import RemoveIcon from '@mui/icons-material/Remove';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';

import { Task } from '@/app/types/taskTypes';
import { getStatusColor } from '@/utils/statusColors';

interface MiniTaskTableProps {
  role: string;
  clerkUserId: string;
}

// Функция для выбора иконки по приоритету
function getPriorityIcon(priority: string) {
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
      return <RemoveIcon sx={{ color: '#28a0e9' }} />;
  }
}

export default function MiniTaskTable({
  role,
  clerkUserId,
}: MiniTaskTableProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Загружаем все задачи
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetch('/api/tasks');
        if (!res.ok) {
          throw new Error('Failed to fetch tasks');
        }
        const data = await res.json();
        setTasks(data.tasks);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Unknown error');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  // 2. Фильтруем задачи
  const filteredTasks = useMemo(() => {
    if (role === 'admin') {
      // Админ видит все задачи
      return tasks;
    } else if (role === 'author') {
      // Автор видит задачи, где authorId == clerkUserId
      return tasks.filter((t) => t.authorId === clerkUserId);
    } else if (role === 'initiator') {
      // Инициатор видит задачи, где initiatorId == clerkUserId
      return tasks.filter((t) => t.initiatorId === clerkUserId);
    } else if (role === 'executor') {
      // Исполнитель видит задачи, где executorId == clerkUserId
      return tasks.filter((t) => t.executorId === clerkUserId);
    }
    return [];
  }, [role, clerkUserId, tasks]);

  // 3. Сортируем по дате создания (createdAt) в убывающем порядке (самые свежие сверху)
  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [filteredTasks]);

  // 4. Берём только первые 5 для отображения
  const lastFive = sortedTasks.slice(0, 5);

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
        No tasks found
      </Typography>
    );
  }

  return (
    <Box>
      {/* Контейнер фиксированной высоты, чтобы 5-я строка отображалась частично */}
      <Box
        sx={{
          position: 'relative',
          maxHeight: 310,
          overflow: 'hidden',
          mb: 2,
        }}
      >
        <TableContainer component={Paper} sx={{ maxHeight: 310 }}>
          <Table size='small' stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Task</TableCell>
                <TableCell align='center'>Created</TableCell>
                <TableCell align='center'>Due Date</TableCell>
                <TableCell align='center'>Status</TableCell>
                <TableCell align='center'>Priority</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lastFive.map((task) => (
                <TableRow key={task.taskId}>
                  <TableCell>
                    <Link href={`/tasks/${task.taskId.toLowerCase()}`}>
                      {task.taskName}
                      {task.bsNumber ? ` / ${task.bsNumber}` : ''}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {new Date(task.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {new Date(task.dueDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell align='center'>
                    <Chip
                      label={task.status}
                      sx={{
                        backgroundColor: getStatusColor(task.status),
                        color: '#fff',
                      }}
                      size='small'
                    />
                  </TableCell>
                  <TableCell align='center'>
                    <Tooltip title={task.priority}>
                      <Box component='span'>
                        {getPriorityIcon(task.priority)}
                      </Box>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

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

      <Box
        sx={{
          textAlign: 'center',
        }}
      >
        <Link href='/tasks'>
          <Button variant='outlined'>All Tasks</Button>
        </Link>
      </Box>
    </Box>
  );
}

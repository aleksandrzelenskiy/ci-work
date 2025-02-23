// app/components/TaskColumnPage.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  Link,
} from '@mui/material';
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { Task } from '../types/taskTypes';
import {
  KeyboardDoubleArrowUp as KeyboardDoubleArrowUpIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  DragHandle as DragHandleIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material';
import { getStatusColor } from '@/utils/statusColors';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';

const statusOrder: CurrentStatus[] = [
  'To do',
  'Assigned',
  'At work',
  'Done',
  'Pending',
  'Issues',
  'Fixed',
  'Agreed',
];

type CurrentStatus =
  | 'To do'
  | 'Assigned'
  | 'At work'
  | 'Done'
  | 'Pending'
  | 'Issues'
  | 'Fixed'
  | 'Agreed';

function DraggableTask({ task, role }: { task: Task; role: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Отключаем DnD для не-админов
    if (role !== 'admin') return;

    return draggable({
      element,
      getInitialData: () => ({ id: task.taskId, status: task.status }),
    });
  }, [task.taskId, task.status, role]);

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

  return (
    <Link
      href={`/tasks/${task.taskId.toLowerCase()}`}
      sx={{ cursor: 'pointer' }}
      underline='none'
    >
      <Card
        ref={ref}
        sx={{
          mb: 2,
          cursor: role === 'admin' ? 'grab' : 'default',
          '&:active': { cursor: role === 'admin' ? 'grabbing' : 'default' },
          boxShadow: 2,
        }}
      >
        <Box sx={{ marginTop: '5px', marginLeft: '5px' }}>
          <Typography variant='caption' color='text.secondary'>
            {new Date(task.createdAt).toLocaleDateString()}
          </Typography>
        </Box>
        <CardContent>
          <Typography variant='subtitle1' gutterBottom>
            {task.taskName}
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant='caption'>BS: {task.bsNumber}</Typography>
          </Box>
          <Typography variant='body2' color='text.primary'>
            Due: {new Date(task.dueDate).toLocaleDateString()}
          </Typography>
        </CardContent>
        <Box
          sx={{
            margin: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Chip
            label={task.status}
            size='small'
            sx={{
              backgroundColor: getStatusColor(task.status),
              color: '#fff',
            }}
          />
          <Typography variant='caption'>
            {getPriorityIcon(task.priority)}
          </Typography>
        </Box>
      </Card>
    </Link>
  );
}

function DroppableColumn({
  status,
  tasks,
  role,
}: {
  status: CurrentStatus;
  tasks: Task[];
  role: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Отключаем DnD для не-админов
    if (role !== 'admin') return;

    return dropTargetForElements({
      element,
      getData: () => ({ status }),
      onDragEnter: () => setIsDraggingOver(true),
      onDragLeave: () => setIsDraggingOver(false),
      onDrop: () => setIsDraggingOver(false),
    });
  }, [status, role]);

  return (
    <Box
      ref={ref}
      sx={{
        minWidth: 200,
        minHeight: '60vh',
        bgcolor: isDraggingOver ? 'action.hover' : 'background.paper',
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        position: 'relative',
      }}
    >
      <Typography variant='h6' sx={{ mb: 2, textTransform: 'lowercase' }}>
        {status} ({tasks.length})
      </Typography>
      {tasks.map((task) => (
        <DraggableTask key={task.taskId} task={task} role={role} />
      ))}
    </Box>
  );
}

export default function TaskColumnPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch('/api/tasks');
        const data = await response.json();

        if (!response.ok)
          throw new Error(data.error || 'Failed to fetch tasks');

        setTasks(data.tasks);
        setLoading(false);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Unknown error');
        setLoading(false);
      }
    };

    const fetchUserRole = async () => {
      try {
        const userResponse = await GetCurrentUserFromMongoDB();
        if (userResponse.success && userResponse.data) {
          setRole(userResponse.data.role);
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };

    fetchTasks();
    fetchUserRole();
  }, []);

  useEffect(() => {
    return monitorForElements({
      onDrop: ({ source, location }) => {
        // Проверяем роль пользователя
        if (role !== 'admin') return;

        const destination = location.current.dropTargets[0];
        if (!destination) return;

        const taskId = source.data.id;
        const newStatus = destination.data.status as CurrentStatus;

        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            task.taskId === taskId ? { ...task, status: newStatus } : task
          )
        );

        fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        }).catch((error) => console.error('Update failed:', error));
      },
    });
  }, [role]);

  if (loading)
    return <CircularProgress sx={{ display: 'block', mx: 'auto', mt: 4 }} />;
  if (error)
    return (
      <Typography color='error' sx={{ mt: 4, textAlign: 'center' }}>
        {error}
      </Typography>
    );

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 3,
        p: 3,
        overflowX: 'auto',
        minHeight: 'calc(100vh - 64px)',
      }}
    >
      {statusOrder.map((status) => (
        <DroppableColumn
          key={status}
          status={status}
          tasks={tasks.filter((task) => task.status === status)}
          role={role}
        />
      ))}
    </Box>
  );
}

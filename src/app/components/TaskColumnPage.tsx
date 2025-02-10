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
// import LocationOnIcon from '@mui/icons-material/LocationOn';
// import Link from 'next/link';

const statusOrder: CurrentStatus[] = [
  'to do',
  'assigned',
  'at work',
  'done',
  'agreed',
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'to do':
      return 'default';
    case 'assigned':
      return 'primary';
    case 'at work':
      return 'secondary';
    case 'done':
      return 'info';
    case 'agreed':
      return 'success';
    default:
      return 'default';
  }
};

type CurrentStatus = 'to do' | 'assigned' | 'at work' | 'done' | 'agreed';

function DraggableTask({ task }: { task: Task }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    return draggable({
      element,
      getInitialData: () => ({ id: task.taskId, status: task.status }),
    });
  }, [task.taskId, task.status]);

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
    <Card
      ref={ref}
      sx={{
        mb: 2,
        cursor: 'grab',
        '&:active': { cursor: 'grabbing' },
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
          color={getStatusColor(task.status)}
        />
        <Typography variant='caption'>
          {getPriorityIcon(task.priority)}
        </Typography>
      </Box>
    </Card>
  );
}

function DroppableColumn({
  status,
  tasks,
}: {
  status: CurrentStatus;
  tasks: Task[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    return dropTargetForElements({
      element,
      getData: () => ({ status }),
      onDragEnter: () => setIsDraggingOver(true),
      onDragLeave: () => setIsDraggingOver(false),
      onDrop: () => setIsDraggingOver(false),
    });
  }, [status]);

  return (
    <Box
      ref={ref}
      sx={{
        width: 300,
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
        <DraggableTask key={task.taskId} task={task} />
      ))}
    </Box>
  );
}

export default function TaskColumnPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    fetchTasks();
  }, []);

  useEffect(() => {
    return monitorForElements({
      onDrop: ({ source, location }) => {
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
  }, []);

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
        />
      ))}
    </Box>
  );
}

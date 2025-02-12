'use client';

import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Box,
  Typography,
  CircularProgress,
  Chip,
  Button,
  Grid,
  Paper,
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Slide,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Link,
  Collapse,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { useParams } from 'next/navigation';
import { Task, WorkItem, BsLocation } from '@/app/types/taskTypes';
import { YMaps, Map, Placemark } from 'react-yandex-maps';
import { TransitionProps } from '@mui/material/transitions';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'to do':
      return 'default';
    case 'assigned':
      return 'info';
    case 'at work':
      return 'secondary';
    case 'done':
      return 'primary';
    case 'agreed':
      return 'success';
    default:
      return 'default';
  }
};

const parseUserInfo = (userString?: string) => {
  if (!userString) return { name: 'N/A', email: 'N/A' };
  const cleanedString = userString.replace(/\)$/, '');
  const parts = cleanedString.split(' (');
  return {
    name: parts[0] || 'N/A',
    email: parts[1] || 'N/A',
  };
};

const Transition = React.forwardRef(function Transition(
  props: TransitionProps & {
    children: React.ReactElement;
  },
  ref: React.Ref<unknown>
) {
  return <Slide direction='up' ref={ref} {...props} />;
});

export default function TaskDetailPage() {
  const { taskid } = useParams();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<BsLocation | null>(
    null
  );
  const [workItemsExpanded, setWorkItemsExpanded] = useState(false);

  const handleClose = () => {
    setOpen(false);
    setSelectedLocation(null);
  };

  const toggleWorkItems = () => {
    setWorkItemsExpanded(!workItemsExpanded);
  };

  useEffect(() => {
    const fetchTask = async () => {
      try {
        const response = await fetch(`/api/tasks/${taskid}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch task');
        }

        setTask(data.task);
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

    fetchTask();
  }, [taskid]);

  if (loading) {
    return <CircularProgress sx={{ display: 'block', margin: '20px auto' }} />;
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color='error' gutterBottom>
          Error: {error}
        </Typography>
        {/* Link to the reports list page */}
        <Box mb={2}>
          <Button
            component={Link}
            href='/tasks'
            variant='text'
            startIcon={<ArrowBackIcon />}
            sx={{ textTransform: 'uppercase' }}
          >
            To Tasks List
          </Button>
        </Box>
      </Box>
    );
  }

  if (!task) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography gutterBottom>Task not found</Typography>
        {/* Link to the reports list page */}
        <Box mb={2}>
          <Button
            component={Link}
            href='/tasks'
            variant='text'
            startIcon={<ArrowBackIcon />}
            sx={{ textTransform: 'uppercase' }}
          >
            To Tasks List
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Link to the reports list page */}
      <Box mb={2}>
        <Button
          component={Link}
          href='/tasks'
          variant='text'
          startIcon={<ArrowBackIcon />}
          sx={{ textTransform: 'uppercase' }}
        >
          To Tasks List
        </Button>
      </Box>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant='h5' component='h1'>
          {task.taskName} | {task.bsNumber} &nbsp;
          <Chip label={task.status} color={getStatusColor(task.status)} />
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6} gap={5}>
          <Box sx={{ mb: 3 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant='h6' gutterBottom>
                Basic Information
              </Typography>
              <Typography>
                <strong>BS:</strong> {task.bsNumber}
              </Typography>
              <Typography>
                <strong>Adress:</strong> {task.bsAddress}
              </Typography>
              <Typography>
                <strong>Total Cost:</strong> {task.totalCost} RUB
              </Typography>
              <Typography>
                <strong>Priority:</strong> {task.priority}
              </Typography>
              <Typography>
                <strong>Created:</strong>{' '}
                {new Date(task.createdAt).toLocaleDateString()}
              </Typography>
              <Typography>
                <strong>Due Date:</strong>{' '}
                {new Date(task.dueDate).toLocaleDateString()}
              </Typography>
            </Paper>
          </Box>
          <Box sx={{ mb: 3 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant='h6' gutterBottom>
                Locations
              </Typography>
              {task.bsLocation.map((location: BsLocation) => (
                <Box key={uuidv4()} sx={{ mb: 1 }}>
                  <Typography>
                    <strong>{location.name}:</strong>
                  </Typography>
                  <Link
                    href={`https://www.google.com/maps?q=${location.coordinates}`}
                    target='_blank'
                    rel='noopener'
                  >
                    {location.coordinates}
                  </Link>
                </Box>
              ))}
            </Paper>
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ mb: 3 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant='h6' gutterBottom>
                Description
              </Typography>
              <Typography>{task.taskDescription}</Typography>
            </Paper>
          </Box>
          <Box sx={{ mb: 3 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant='h6' gutterBottom>
                Participants
              </Typography>
              <Typography>
                <strong>Author:</strong> {parseUserInfo(task.authorName).name}
              </Typography>
              <Typography>
                <strong>Email:</strong> {parseUserInfo(task.authorEmail).name}
              </Typography>

              <Typography sx={{ mt: 2 }}>
                <strong>Initiator:</strong>{' '}
                {parseUserInfo(task.initiatorName).name}
              </Typography>
              <Typography>
                <strong>Email:</strong>{' '}
                {parseUserInfo(task.initiatorEmail).name}
              </Typography>

              <Typography sx={{ mt: 2 }}>
                <strong>Executor:</strong>{' '}
                {parseUserInfo(task.executorName).name}
              </Typography>
              <Typography>
                <strong>Email:</strong> {parseUserInfo(task.executorEmail).name}
              </Typography>
            </Paper>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant='h6' gutterBottom>
              Photo report
            </Typography>
            <Link>Photo reports Link</Link>
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Paper>
            <Box>
              <Button
                onClick={toggleWorkItems}
                size='large'
                endIcon={
                  workItemsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />
                }
              >
                Work Items
              </Button>
            </Box>
            <Collapse in={workItemsExpanded}>
              <TableContainer>
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
                      <TableRow key={uuidv4()}>
                        <TableCell>{item.workType}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.unit}</TableCell>
                        <TableCell>{item.note}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Collapse>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Box sx={{ mb: 3 }}>
            <Typography>Reserved</Typography>
          </Box>
          <Box sx={{ mb: 3 }}>
            <Typography variant='h6' gutterBottom>
              Attachments
            </Typography>
            {task.orderUrl && (
              <Link
                component='a'
                href={
                  Array.isArray(task.orderUrl)
                    ? task.orderUrl[0]
                    : task.orderUrl
                }
                download
                target='_blank'
                sx={{ textDecoration: 'none', color: 'primary.main' }}
              >
                Download Order File
              </Link>
            )}
            {task.attachments?.length === 0 && (
              <Typography variant='body2'>
                No any attachments available
              </Typography>
            )}
          </Box>
        </Grid>
      </Grid>

      <Dialog
        fullScreen
        open={open}
        onClose={handleClose}
        TransitionComponent={Transition}
      >
        <AppBar sx={{ position: 'relative' }}>
          <Toolbar>
            <IconButton
              edge='start'
              color='inherit'
              onClick={handleClose}
              aria-label='close'
            >
              <CloseIcon />
            </IconButton>
            <Typography sx={{ ml: 2, flex: 1 }} variant='h6' component='div'>
              {selectedLocation?.name}
            </Typography>
          </Toolbar>
        </AppBar>
        <Box sx={{ height: '100%', width: '100%' }}>
          <YMaps>
            <Map
              defaultState={{
                center: [0, 0],
                zoom: 15,
              }}
              width='100%'
              height='100%'
            >
              <Placemark geometry={[0, 0]} />
            </Map>
          </YMaps>
        </Box>
      </Dialog>
    </Box>
  );
}

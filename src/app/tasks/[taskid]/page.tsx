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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Snackbar,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

import { useParams } from 'next/navigation';
import {
  Task,
  WorkItem,
  BsLocation,
  CurrentStatus,
} from '@/app/types/taskTypes';
import { YMaps, Map, Placemark } from 'react-yandex-maps';
import { TransitionProps } from '@mui/material/transitions';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';

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
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    'accept' | 'reject' | null
  >(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>(
    'success'
  );

  useEffect(() => {
    const fetchUserRole = async () => {
      const user = await GetCurrentUserFromMongoDB();
      if (user.success) {
        setUserRole(user.data.role);
      }
    };

    fetchUserRole();
  }, []);

  const updateStatus = async (newStatus: CurrentStatus) => {
    try {
      setLoadingStatus(true);
      const response = await fetch(`/api/tasks/${taskid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      const { task: updatedTask } = await response.json();
      setTask(updatedTask);
      setSnackbarMessage(
        newStatus === 'at work'
          ? 'Task accepted successfully!'
          : 'Task rejected successfully!'
      );
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Error updating status:', error);
      setSnackbarMessage('Failed to update task status');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setLoadingStatus(false);
      setConfirmDialogOpen(false);
    }
  };

  const handleConfirmAction = () => {
    if (confirmAction === 'accept') {
      updateStatus('at work');
    } else if (confirmAction === 'reject') {
      updateStatus('to do');
    }
  };

  const handleCloseConfirmDialog = () => {
    setConfirmDialogOpen(false);
    setConfirmAction(null);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

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
      <Chip label={task.taskId} size='small' color='primary' sx={{ mb: 3 }} />
      <Grid container spacing={3}>
        <Grid item xs={12} md={6} gap={5}>
          <Box sx={{ mb: 3 }}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant='h6'>Basic Information</Typography>
              </AccordionSummary>
              <AccordionDetails>
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
              </AccordionDetails>
            </Accordion>
          </Box>
          <Box sx={{ mb: 0 }}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant='h6'>Locations</Typography>
              </AccordionSummary>
              <AccordionDetails>
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
              </AccordionDetails>
            </Accordion>
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box sx={{ mb: 3 }}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant='h6'>Description</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography>{task.taskDescription}</Typography>
              </AccordionDetails>
            </Accordion>
          </Box>
          <Box sx={{ mb: 3 }}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant='h6'>Participants</Typography>
              </AccordionSummary>
              <AccordionDetails>
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
                  <strong>Email:</strong>{' '}
                  {parseUserInfo(task.executorEmail).name}
                </Typography>
              </AccordionDetails>
            </Accordion>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Typography variant='h6' gutterBottom>
              Photo report
            </Typography>
            <Link>Photo reports Link</Link>
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary
              expandIcon={
                workItemsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />
              }
              onClick={toggleWorkItems}
            >
              <Typography variant='h6'>Work Items</Typography>
            </AccordionSummary>
            <AccordionDetails>
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
            </AccordionDetails>
          </Accordion>
        </Grid>

        <Grid item xs={12}>
          {userRole !== 'executor' && task.status === 'assigned' && (
            <Box sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <Box
                  sx={{
                    mb: 3,
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 2,
                  }}
                >
                  <Button
                    variant='contained'
                    color='success'
                    onClick={() => {
                      setConfirmAction('accept');
                      setConfirmDialogOpen(true);
                    }}
                    disabled={loadingStatus}
                  >
                    {loadingStatus ? <CircularProgress size={24} /> : 'Accept'}
                  </Button>
                  <Button
                    variant='contained'
                    color='error'
                    onClick={() => {
                      setConfirmAction('reject');
                      setConfirmDialogOpen(true);
                    }}
                    disabled={loadingStatus}
                  >
                    {loadingStatus ? <CircularProgress size={24} /> : 'Reject'}
                  </Button>
                </Box>
              </Grid>
            </Box>
          )}
          {userRole === 'executor' && (
            <Box sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <Box
                  sx={{
                    mb: 3,
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 2,
                  }}
                >
                  <Button
                    variant='contained'
                    color='success'
                    onClick={async () => await updateStatus('at work')}
                    disabled={loadingStatus}
                  >
                    {loadingStatus ? <CircularProgress size={24} /> : 'Accept'}
                  </Button>
                  <Button
                    variant='contained'
                    color='error'
                    onClick={async () => await updateStatus('to do')}
                    disabled={loadingStatus}
                  >
                    {loadingStatus ? <CircularProgress size={24} /> : 'Reject'}
                  </Button>
                </Box>
              </Grid>
            </Box>
          )}
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

      <Dialog
        open={confirmDialogOpen}
        onClose={handleCloseConfirmDialog}
        aria-labelledby='confirm-dialog-title'
        aria-describedby='confirm-dialog-description'
      >
        <DialogTitle id='confirm-dialog-title'>
          {confirmAction === 'accept'
            ? `Are you sure you want to accept the task ${task.taskName} | ${task.bsNumber}?`
            : `Are you sure you want to reject the task ${task.taskName} | ${task.bsNumber}?`}
        </DialogTitle>
        <DialogContent>
          {confirmAction === 'accept' && (
            <Typography>
              The due date is {new Date(task.dueDate).toLocaleDateString()}.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseConfirmDialog}
            color='primary'
            variant='outlined'
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmAction}
            color={confirmAction === 'accept' ? 'success' : 'error'}
            variant='contained'
          >
            {confirmAction === 'accept' ? 'Accept' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

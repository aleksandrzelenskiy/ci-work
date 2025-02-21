// app/tasks/[taskid]/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Box,
  Typography,
  CircularProgress,
  Chip,
  Button,
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
  Grid,
  Paper,
} from '@mui/material';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent';
import InfoIcon from '@mui/icons-material/Info';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import DescriptionIcon from '@mui/icons-material/Description';
import GroupIcon from '@mui/icons-material/Group';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import TableRowsIcon from '@mui/icons-material/TableRows';
import HistoryIcon from '@mui/icons-material/History';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import EditIcon from '@mui/icons-material/Edit';
import { useParams } from 'next/navigation';
import {
  Task,
  WorkItem,
  BsLocation,
  CurrentStatus,
  TaskEvent,
  PhotoReport,
} from '@/app/types/taskTypes';
import { YMaps, Map, Placemark } from 'react-yandex-maps';
import { TransitionProps } from '@mui/material/transitions';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';
import TaskForm from '@/app/components/TaskForm';

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'warning';
    case 'issues':
      return 'error';
    case 'fixed':
      return 'info';
    case 'agreed':
      return 'success';
    case 'to do':
      return 'default';
    case 'assigned':
      return 'info';
    case 'at work':
      return 'secondary';
    case 'done':
      return 'primary';
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
    'accept' | 'reject' | 'done' | 'refuse' | null
  >(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>(
    'success'
  );
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);

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

      const user = await GetCurrentUserFromMongoDB();
      if (!user.success) {
        throw new Error('Failed to fetch user data');
      }

      const event = {
        action: 'STATUS_CHANGED',
        author: user.data.name,
        authorId: user.data._id,
        details: {
          oldStatus: task?.status,
          newStatus: newStatus,
        },
      };

      const response = await fetch(`/api/tasks/${taskid}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          event,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      const { task: updatedTask } = await response.json();
      setTask(updatedTask);
      setSnackbarMessage(
        newStatus === 'at work'
          ? 'Task accepted successfully!'
          : newStatus === 'done'
          ? 'Task marked as done successfully!'
          : newStatus === 'to do'
          ? confirmAction === 'reject'
            ? 'Task rejected successfully!'
            : 'Task refused successfully!'
          : ''
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
    } else if (confirmAction === 'reject' || confirmAction === 'refuse') {
      updateStatus('to do');
    } else if (confirmAction === 'done') {
      updateStatus('done');
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

  const handleDownloadReport = async (report: PhotoReport) => {
    try {
      const response = await fetch(
        `/api/reports/${encodeURIComponent(report.task)}/${
          report.baseId
        }/download`
      );
      if (!response.ok) throw new Error('Failed to download');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${report.baseId}.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      setSnackbarMessage('Ошибка при скачивании отчета');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
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

  const isExecutor = userRole === 'executor';
  const isTaskAssigned = task.status === 'assigned';
  const isTaskAtWork = task.status === 'at work';

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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Chip label={task.taskId} color='default' />
        {userRole !== 'executor' && (
          <Button
            size='small'
            variant='outlined'
            startIcon={<EditIcon />}
            onClick={() => setIsEditFormOpen(true)}
          >
            Edit
          </Button>
        )}
        <Typography variant='body2' component='span'>
          Created by{' '}
          {task.events?.find((event) => event.action === 'TASK_CREATED')
            ?.author || task.authorName}{' '}
          on{' '}
          {new Date(
            task.events?.find((event) => event.action === 'TASK_CREATED')
              ?.date || task.createdAt
          ).toLocaleDateString()}
        </Typography>
      </Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Box sx={{ mb: 3 }}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant='h6'>
                  <InfoIcon /> Basic Information
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography>
                  <strong>BS:</strong> {task.bsNumber}
                </Typography>
                <Typography>
                  <strong>Address:</strong> {task.bsAddress}
                </Typography>
                <Typography>
                  <strong>
                    {userRole === 'executor' ? 'Cost:' : 'Total Cost:'}
                  </strong>{' '}
                  {userRole === 'executor'
                    ? `${(task.totalCost * 0.7).toFixed(2)} RUB`
                    : `${task.totalCost} RUB`}
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
                <Typography variant='h6'>
                  <LocationOnIcon /> Locations
                </Typography>
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
                <Typography variant='h6'>
                  <DescriptionIcon /> Description
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography>{task.taskDescription}</Typography>
              </AccordionDetails>
            </Accordion>
          </Box>
          <Box sx={{ mb: 3 }}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant='h6'>
                  <GroupIcon /> Participants
                </Typography>
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
            {task.status === 'done' &&
              task.photoReports &&
              task.photoReports.length > 0 && (
                <Grid item xs={12}>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant='h6'>
                        <PhotoLibraryIcon /> Task Reports
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        {task.photoReports.map((report) => (
                          <Grid item xs={12} sm={6} key={report._id}>
                            <Link
                              href={`/reports/${encodeURIComponent(
                                report.task
                              )}/${report.baseId}`}
                              underline='none'
                            >
                              <Paper elevation={1} sx={{ p: 2 }}>
                                <Box
                                  display='flex'
                                  justifyContent='space-between'
                                  mb={1}
                                >
                                  <Typography variant='subtitle1'>
                                    BS: {report.baseId}
                                  </Typography>
                                  <Chip
                                    label={report.status}
                                    color={getStatusColor(report.status)}
                                    size='small'
                                  />
                                </Box>

                                <Typography
                                  variant='body2'
                                  color='text.secondary'
                                  mb={2}
                                >
                                  Created at:{' '}
                                  {new Date(
                                    report.createdAt
                                  ).toLocaleDateString()}
                                </Typography>

                                <Box display='flex'>
                                  {report.status === 'Agreed' && (
                                    <Button
                                      variant='contained'
                                      size='small'
                                      startIcon={<CloudDownloadIcon />}
                                      onClick={() =>
                                        handleDownloadReport(report)
                                      }
                                    >
                                      Download
                                    </Button>
                                  )}
                                </Box>
                              </Paper>
                            </Link>
                          </Grid>
                        ))}
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
              )}
          </Box>

          <Box sx={{ mb: 3 }}>
            {userRole === 'executor' &&
              task.status === 'done' &&
              !task.photoReports && (
                <>
                  <Typography variant='h6' gutterBottom>
                    Upload Report
                  </Typography>
                  <Button
                    variant='outlined'
                    startIcon={<CloudUploadIcon />}
                    component={Link}
                    href={`/upload?taskId=${
                      task.taskId
                    }&taskName=${encodeURIComponent(
                      task.taskName
                    )}&bsNumber=${encodeURIComponent(
                      task.bsNumber
                    )}&executorName=${encodeURIComponent(
                      task.executorName
                    )}&executorId=${
                      task.executorId
                    }&initiatorName=${encodeURIComponent(
                      task.initiatorName
                    )}&initiatorId=${task.initiatorId}`}
                  >
                    Upload reports
                  </Button>
                </>
              )}
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
              <Typography variant='h6'>
                <TableRowsIcon /> Work Items
              </Typography>
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
          {isExecutor && isTaskAssigned && (
            <Box sx={{ mb: 3 }}>
              <Box
                sx={{
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
            </Box>
          )}

          {isExecutor && isTaskAtWork && (
            <Box sx={{ mb: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 2,
                }}
              >
                <Button
                  variant='contained'
                  color='primary'
                  onClick={() => {
                    setConfirmAction('done');
                    setConfirmDialogOpen(true);
                  }}
                  disabled={loadingStatus}
                >
                  {loadingStatus ? <CircularProgress size={24} /> : 'Done'}
                </Button>
                <Button
                  variant='contained'
                  color='error'
                  onClick={() => {
                    setConfirmAction('refuse');
                    setConfirmDialogOpen(true);
                  }}
                  disabled={loadingStatus}
                >
                  {loadingStatus ? <CircularProgress size={24} /> : 'Refuse'}
                </Button>
              </Box>
            </Box>
          )}
        </Grid>

        <Grid item xs={12}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant='h6'>
                <HistoryIcon /> Task History
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Timeline>
                {task.events?.map((event: TaskEvent) => (
                  <TimelineItem key={event._id}>
                    <TimelineOppositeContent sx={{ py: '12px', px: 2 }}>
                      <Typography variant='body2' color='textSecondary'>
                        {new Date(event.date).toLocaleDateString()}
                        <br />
                        {new Date(event.date).toLocaleTimeString()}
                      </Typography>
                    </TimelineOppositeContent>
                    <TimelineSeparator>
                      <TimelineDot
                        color={
                          event.action === 'TASK_CREATED'
                            ? 'secondary'
                            : event.action === 'STATUS_CHANGED'
                            ? 'primary'
                            : 'grey'
                        }
                      >
                        {event.action === 'TASK_CREATED' && (
                          <CheckIcon fontSize='small' />
                        )}
                        {event.action === 'STATUS_CHANGED' && (
                          <ExpandMoreIcon fontSize='small' />
                        )}
                      </TimelineDot>
                      <TimelineConnector />
                    </TimelineSeparator>
                    <TimelineContent sx={{ py: '12px', px: 2 }}>
                      <Typography variant='body1' component='div'>
                        {event.action.replace('_', ' ')}
                      </Typography>
                      <Typography variant='body2' component='div'>
                        Author: {parseUserInfo(event.author).name}
                      </Typography>
                      {event.details && (
                        <Typography variant='caption' color='textSecondary'>
                          {event.details.oldStatus &&
                            `From: ${event.details.oldStatus}`}
                          {event.details.newStatus &&
                            ` → To: ${event.details.newStatus}`}
                          {event.details.comment &&
                            ` (${event.details.comment})`}
                        </Typography>
                      )}
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>
              {!task.events?.length && (
                <Typography variant='body2' color='textSecondary' sx={{ p: 2 }}>
                  No events recorded for this task
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>
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
          {confirmAction === 'accept' &&
            `Are you sure you want to accept the task ${task.taskName} | ${task.bsNumber}?`}
          {confirmAction === 'reject' &&
            `Are you sure you want to reject the task ${task.taskName} | ${task.bsNumber}?`}
          {confirmAction === 'done' &&
            `Are you sure you want to mark the task ${task.taskName} | ${task.bsNumber} as done?`}
          {confirmAction === 'refuse' &&
            `Are you sure you want to refuse the task ${task.taskName} | ${task.bsNumber}?`}
        </DialogTitle>
        <DialogContent>
          {(confirmAction === 'accept' || confirmAction === 'done') && (
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
            color={
              confirmAction === 'accept' || confirmAction === 'done'
                ? 'primary'
                : 'error'
            }
            variant='contained'
          >
            {confirmAction === 'accept' && 'Accept'}
            {confirmAction === 'reject' && 'Reject'}
            {confirmAction === 'done' && 'Mark Done'}
            {confirmAction === 'refuse' && 'Refuse'}
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
      <TaskForm
        open={isEditFormOpen}
        task={task}
        onClose={() => setIsEditFormOpen(false)}
        onSubmit={async (formData) => {
          try {
            const response = await fetch(`/api/tasks/${taskid}`, {
              method: 'PATCH',
              body: formData,
            });

            if (!response.ok) {
              throw new Error('Failed to update task');
            }

            const { task: updatedTask } = await response.json();
            setTask(updatedTask);
            setSnackbarMessage('Task updated successfully!');
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
          } catch (error) {
            console.error('Error updating task:', error);
            setSnackbarMessage('Failed to update task');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
          } finally {
            setIsEditFormOpen(false);
          }
        }}
      />
    </Box>
  );
}

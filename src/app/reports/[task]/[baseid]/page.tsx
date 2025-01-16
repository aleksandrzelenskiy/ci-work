'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  CircularProgress,
  Typography,
  Grid,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Chip,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import { ZoomIn, ZoomOut, RotateRight } from '@mui/icons-material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckIcon from '@mui/icons-material/Check';
import { useParams } from 'next/navigation';
import { useDropzone, Accept } from 'react-dropzone';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import Link from 'next/link';

// Interface for managing uploaded files
interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  progress: number;
}

// Interface for details in STATUS_CHANGED
interface IStatusChangedDetails {
  oldStatus: string;
  newStatus: string;
}

// Interface for event
interface IEvent {
  action: string;
  author: string;
  date: string;
  details?: IStatusChangedDetails;
}

const ACTIONS = {
  REPORT_CREATED: 'REPORT_CREATED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  ISSUES_CREATED: 'ISSUES_CREATED',
  ISSUES_UPDATED: 'ISSUES_UPDATED',
  FIXED_PHOTOS: 'FIXED_PHOTOS',
};

export default function PhotoReportPage() {
  const { task, baseid } = useParams() as { task: string; baseid: string };

  // Current user's name
  const currentUser = 'Ivan Petrov';

  const [photos, setPhotos] = useState<string[]>([]);
  const [fixedPhotos, setFixedPhotos] = useState<string[]>([]);
  const [issues, setIssues] = useState<{ text: string; checked: boolean }[]>(
    []
  );
  const [newIssues, setNewIssues] = useState<string[]>(['']);
  const [showIssuesFields, setShowIssuesFields] = useState(false);
  const [buttonText, setButtonText] = useState('Add Issues');
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(
    null
  );
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isFixedReady, setIsFixedReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // State for report dowloading
  const [downloading, setDownloading] = useState(false);

  // State for events
  const [events, setEvents] = useState<IEvent[]>([]);

  // States for createdAt and userName
  const [createdAt, setCreatedAt] = useState<string>('N/A');
  const [userName, setUserName] = useState<string>('Unknown');

  // New state to track if all issues are fixed
  const [issuesFixed, setIssuesFixed] = useState(false);

  // States for agreement confirmation dialog and message
  const [openAgreeDialog, setOpenAgreeDialog] = useState(false);

  // New state to track current status
  const [status, setStatus] = useState<string>('Pending');

  // For cleaning up object URLs
  useEffect(() => {
    return () => {
      uploadedFiles.forEach((file) => URL.revokeObjectURL(file.preview));
    };
  }, [uploadedFiles]);

  // Helper function to get the latest event by action and filter
  const getLatestEvent = useCallback(
    (action: string, filter?: (event: IEvent) => boolean): IEvent | null => {
      let relatedEvents = events.filter((event) => event.action === action);
      if (filter) {
        relatedEvents = relatedEvents.filter(filter);
      }
      console.log(`Events with action "${action}":`, relatedEvents);
      if (relatedEvents.length === 0) return null;
      return relatedEvents.reduce((latest, event) =>
        new Date(event.date) > new Date(latest.date) ? event : latest
      );
    },
    [events]
  );

  // Get the latest events for each section
  const photoReportEvent = getLatestEvent(ACTIONS.REPORT_CREATED);
  const issuesCreatedEvent = getLatestEvent(ACTIONS.ISSUES_CREATED);
  const issuesUpdatedEvent = getLatestEvent(ACTIONS.ISSUES_UPDATED);
  const fixedPhotosEvent = getLatestEvent(ACTIONS.FIXED_PHOTOS);
  // Now REPORT_AGREED looks for STATUS_CHANGED with newStatus: 'Agreed'
  const reportStatusEvent = getLatestEvent(ACTIONS.STATUS_CHANGED, (event) =>
    event.details ? event.details.newStatus === 'Agreed' : false
  );

  // Function to fetch the report
  const fetchReport = useCallback(async () => {
    try {
      const response = await fetch(`/api/reports/${task}/${baseid}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch report. Status: ${response.status}`);
      }

      const data = await response.json();
      setPhotos(data.files || []);
      setFixedPhotos(data.fixedFiles || []);

      // Determine if status is 'Fixed' or 'Agreed'
      const isFixedOrAgreed =
        data.status === 'Fixed' || data.status === 'Agreed';

      setIssues(
        (data.issues || []).map((issue: string) => ({
          text: issue,
          checked: isFixedOrAgreed, // Set checked to true for 'Fixed' and 'Agreed' statuses
        }))
      );

      // Set createdAt and userName
      setCreatedAt(new Date(data.createdAt).toLocaleDateString() || 'N/A');
      setUserName(data.userName || 'Unknown');

      // Set events
      setEvents(data.events || []);

      // Set issuesFixed state based on fixedFiles
      setIssuesFixed((data.fixedFiles || []).length > 0);

      // Set current status
      setStatus(data.status || 'Pending');

      console.log('Fetched events:', data.events);
    } catch (err: unknown) {
      console.error('Error fetching report:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load report. Please try again later.'
      );
    } finally {
      setLoading(false);
    }
  }, [task, baseid]);

  // Load the report from the database on mount and when task/baseid changes
  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleAddIssueField = () => {
    setNewIssues([...newIssues, '']);
  };

  const handleIssueChange = (index: number, value: string) => {
    const updatedNewIssues = [...newIssues];
    updatedNewIssues[index] = value;
    setNewIssues(updatedNewIssues);
  };

  const handleAgreeClick = () => {
    // Open the agreement confirmation dialog
    setOpenAgreeDialog(true);
  };

  const handleConfirmAgree = async () => {
    setOpenAgreeDialog(false);
    try {
      const response = await fetch(`/api/reports/${task}/${baseid}`);
      if (!response.ok) {
        throw new Error('Failed to fetch current status.');
      }
      const data = await response.json();

      if (data.status === 'Agreed') {
        showAlert(
          `Photo report ${decodeURIComponent(
            task
          )} | Base: ${decodeURIComponent(baseid)} has already been agreed.`,
          'info'
        );
        return;
      }

      const updateResponse = await fetch(`/api/reports/${task}/${baseid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Agreed' }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update status.');
      }

      showAlert('Status has been updated to Agreed.', 'success');

      // **Optimistically update the status state**
      setStatus('Agreed');

      // **Add a new event to the events array**
      const newEvent: IEvent = {
        action: ACTIONS.STATUS_CHANGED,
        author: currentUser,
        date: new Date().toISOString(),
        details: {
          oldStatus: data.status,
          newStatus: 'Agreed',
        },
      };
      setEvents((prevEvents) => [...prevEvents, newEvent]);
    } catch (error) {
      console.error('Error updating status:', error);
      showAlert('Error updating status. Please try again.', 'error');
    }
  };

  const handleCancelAgree = () => {
    // Close the agreement confirmation dialog without actions
    setOpenAgreeDialog(false);
  };

  // Removing issues (by index)
  const confirmRemoveIssue = (index: number) => {
    setConfirmDeleteIndex(index);
  };

  const handleDeleteIssueField = async () => {
    if (confirmDeleteIndex === null) return;

    const issueToDelete = newIssues[confirmDeleteIndex];
    if (!issueToDelete) {
      setConfirmDeleteIndex(null);
      return;
    }

    // Optimistically remove from the UI
    const updatedNewIssues = [...newIssues];
    updatedNewIssues.splice(confirmDeleteIndex, 1);
    setNewIssues(updatedNewIssues);
    setConfirmDeleteIndex(null);

    try {
      const response = await fetch(`/api/reports/${task}/${baseid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deleteIssueIndex: confirmDeleteIndex,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete issue.');
      }
    } catch (error) {
      console.error('Error deleting issue:', error);
      showAlert('Failed to delete issue. Please try again.', 'error');
      // In case of error, rollback
      setNewIssues((prevIssues) => {
        const restoredIssues = [...prevIssues];
        restoredIssues.splice(confirmDeleteIndex, 0, issueToDelete);
        return restoredIssues;
      });
    }
  };

  const handleCheckboxChange = (index: number) => {
    const updatedIssues = [...issues];
    updatedIssues[index].checked = !updatedIssues[index].checked;
    setIssues(updatedIssues);

    const allFixed = updatedIssues.every((issue) => issue.checked);
    setIsFixedReady(allFixed);

    // Update issuesFixed based on all issues
    setIssuesFixed(allFixed);
  };

  const handleIssuesClick = () => {
    const currentIssuesTexts = issues.map((issue) => issue.text);
    setNewIssues(currentIssuesTexts.length > 0 ? currentIssuesTexts : ['']);
    setShowIssuesFields(true);
    setButtonText(issues.length > 0 ? 'Update' : 'Add Issues');
  };

  const handleAddIssuesClick = async () => {
    const currentIssues = issues.map((issue) => issue.text);
    const filteredNewIssues = newIssues.filter((issue) => issue.trim() !== '');

    const addedIssues = filteredNewIssues.filter(
      (issue) => !currentIssues.includes(issue)
    );
    const updatedIssues = filteredNewIssues.filter(
      (issue, index) => currentIssues[index] !== issue
    );
    const deletedIssues = currentIssues.filter(
      (issue) => !filteredNewIssues.includes(issue)
    );

    if (
      addedIssues.length === 0 &&
      updatedIssues.length === 0 &&
      deletedIssues.length === 0
    ) {
      setShowIssuesFields(false);
      return;
    }

    try {
      const response = await fetch(`/api/reports/${task}/${baseid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issues: filteredNewIssues,
          status: 'Issues',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update issues.');
      }

      // **Optimistically update the status state**
      setStatus('Issues');

      // **Add a new event to the events array**
      const newEvent: IEvent = {
        action:
          addedIssues.length > 0
            ? ACTIONS.ISSUES_CREATED
            : ACTIONS.ISSUES_UPDATED,
        author: currentUser,
        date: new Date().toISOString(),
      };
      setEvents((prevEvents) => [...prevEvents, newEvent]);

      setIssues(
        filteredNewIssues.map((issue) => ({ text: issue, checked: false }))
      );
      setShowIssuesFields(false);
      setNewIssues(['']);
      setIssuesFixed(false);
    } catch (error) {
      console.error('Error updating issues:', error);
      showAlert('Failed to update issues. Please try again.', 'error');
    }
  };

  // Handling files on drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      id: `${Date.now()}-${file.name}`,
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
    }));
    setUploadedFiles((prevFiles) => [...prevFiles, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'image/*': [] } as Accept,
    maxSize: 5 * 1024 * 1024,
    onDropRejected: (fileRejections) => {
      fileRejections.forEach((rejection) => {
        rejection.errors.forEach((error) => {
          showAlert(`Error: ${error.message}`, 'error');
        });
      });
    },
  });

  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
  };

  // State for deleting files (fixed)
  const [fileToDelete, setFileToDelete] = useState<UploadedFile | null>(null);
  const handleDeleteFile = () => {
    if (fileToDelete) {
      handleRemoveFile(fileToDelete.id);
    }
    setFileToDelete(null);
  };
  const handleDeleteConfirmed = () => {
    if (fileToDelete) {
      handleDeleteFile();
    }
    setFileToDelete(null);
  };

  const handleUploadClick = async () => {
    if (uploadedFiles.length === 0) {
      showAlert('Please select images to upload.', 'warning');
      return;
    }

    setUploading(true);

    try {
      // Create a single FormData
      const formData = new FormData();
      formData.append('baseId', baseid);
      formData.append('task', task);

      // Add all files
      for (const uploadedFile of uploadedFiles) {
        formData.append('image[]', uploadedFile.file);
      }

      // Single XMLHttpRequest for all files
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload/fixed', true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const totalProgress = (event.loaded / event.total) * 100;
          setUploadedFiles((prevFiles) =>
            prevFiles.map((f) => ({ ...f, progress: totalProgress }))
          );
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          showAlert('Fixed photos uploaded successfully.', 'success');
          setUploadedFiles([]);
          setIsFixedReady(false);
          setIssuesFixed(true);

          // **Optimistically update the status state**
          setStatus('Fixed');

          // **Add a new event to the events array**
          const newEvent: IEvent = {
            action: ACTIONS.FIXED_PHOTOS,
            author: currentUser,
            date: new Date().toISOString(),
          };
          setEvents((prevEvents) => [...prevEvents, newEvent]);

          // Update the photos list
          await fetchReport();
        } else {
          showAlert('Failed to upload image(s).', 'error');
        }
        setUploading(false);
      };

      xhr.onerror = () => {
        showAlert('An error occurred during the upload.', 'error');
        setUploading(false);
      };

      xhr.send(formData);
    } catch (error) {
      console.error('Error uploading files:', error);
      showAlert('Error uploading files.', 'error');
      setUploading(false);
    }
  };

  const handleCloseIssuesFields = () => {
    setShowIssuesFields(false);
    setNewIssues(['']);
  };

  // Function to get badge color based on status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'warning';
      case 'Issues':
        return 'error';
      case 'Fixed':
        return 'warning';
      case 'Agreed':
        return 'success';
      default:
        return 'default';
    }
  };

  // Function to get message based on status
  const getStatusMessage = () => {
    switch (status) {
      case 'Pending':
        return photoReportEvent
          ? `Photo report sent for review by ${
              photoReportEvent.author
            } on ${new Date(photoReportEvent.date).toLocaleDateString()}.`
          : 'Pending';
      case 'Issues':
        return issuesUpdatedEvent
          ? `Issues have been updated to the photo report by ${
              issuesUpdatedEvent.author
            } on ${new Date(issuesUpdatedEvent.date).toLocaleDateString()}.`
          : issuesCreatedEvent
          ? `Issues have been added to the photo report by ${
              issuesCreatedEvent.author
            } on ${new Date(issuesCreatedEvent.date).toLocaleDateString()}.`
          : 'Issues';
      case 'Fixed':
        return fixedPhotosEvent
          ? `Issues with the photo report have been Fixed. Photos were uploaded by ${
              fixedPhotosEvent.author
            } on ${new Date(fixedPhotosEvent.date).toLocaleDateString()}.`
          : 'Fixed';
      case 'Agreed':
        return reportStatusEvent
          ? `Photo report has been approved by ${
              reportStatusEvent.author
            } on ${new Date(reportStatusEvent.date).toLocaleDateString()}.`
          : 'Agreed';
      default:
        return '';
    }
  };

  // Add state for managing notifications
  const [alertState, setAlertState] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'success' });

  // Function to display notification
  const showAlert = (
    message: string,
    severity: 'success' | 'error' | 'info' | 'warning'
  ) => {
    setAlertState({ open: true, message, severity });
  };

  // Function for download report
  const handleDownloadReport = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/reports/${task}/${baseid}/download`, {
        method: 'GET',
      });
      if (!response.ok) {
        throw new Error(
          `Failed to download report. Status: ${response.status}`
        );
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;

      // Trying to extract the file name from the response headers
      const contentDisposition = response.headers.get('content-disposition');
      let fileName = 'report.zip';
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="(.+)"/);
        if (fileNameMatch && fileNameMatch.length > 1)
          fileName = fileNameMatch[1];
      }

      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      showAlert('Report downloaded successfully.', 'success');
    } catch (error) {
      console.error('Error downloading report:', error);
      showAlert('Failed to download report. Please try again.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  // Function to close notification
  const handleCloseAlert = (
    event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === 'clickaway') {
      return;
    }
    setAlertState((prev) => ({ ...prev, open: false }));
  };

  if (loading) {
    return (
      <Box display='flex' justifyContent='center' mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display='flex' justifyContent='center' mt={4}>
        <Typography color='error'>{error}</Typography>
      </Box>
    );
  }

  const generateAgreeMessage = () => {
    if (status === 'Agreed' && reportStatusEvent) {
      return `Photo report ${decodeURIComponent(
        task
      )} | Base ID: ${decodeURIComponent(baseid)} has been agreed by user ${
        reportStatusEvent.author
      } on ${new Date(reportStatusEvent.date).toLocaleDateString()}.`;
    }
    return null;
  };

  const agreeMessage = generateAgreeMessage();

  return (
    <Box>
      {/* Snackbar for displaying notifications */}
      <Snackbar
        open={alertState.open}
        autoHideDuration={3000}
        onClose={handleCloseAlert}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseAlert}
          severity={alertState.severity}
          sx={{ width: '100%' }}
        >
          {alertState.message}
        </Alert>
      </Snackbar>

      {/* Link to the reports list page */}
      <Box mb={2}>
        <Button
          component={Link}
          href='/reports'
          variant='text'
          startIcon={<ArrowBackIcon />}
          sx={{ textTransform: 'uppercase' }}
        >
          To Reports List
        </Button>
      </Box>

      {/* Main title */}
      <Typography variant='h5' gutterBottom sx={{ textTransform: 'none' }}>
        <Chip
          label={status}
          color={getStatusColor(status)}
          sx={{ mb: 1, mr: 1 }}
        />
        {decodeURIComponent(task)} | Base ID: {decodeURIComponent(baseid)}
      </Typography>
      <Typography variant='body2' gutterBottom>
        Photo report created by {userName} on {createdAt}
      </Typography>
      <Typography variant='body2' gutterBottom>
        {getStatusMessage()}
      </Typography>

      {/* Photo Report Section */}
      <Typography
        variant='h6'
        gutterBottom
        sx={{ textTransform: 'uppercase', mt: 4 }}
      >
        Photo Report
      </Typography>
      {photoReportEvent && (
        <Typography variant='body2' gutterBottom>
          Created by {photoReportEvent.author} |{' '}
          {new Date(photoReportEvent.date).toLocaleDateString()}
        </Typography>
      )}
      <PhotoProvider
        toolbarRender={({ onScale, scale, onRotate, rotate }) => (
          <Box
            display='flex'
            justifyContent='center'
            alignItems='center'
            gap={1.5}
            p={1}
          >
            <ZoomIn
              style={{ cursor: 'pointer', color: 'rgba(255, 255, 255, 0.75)' }}
              fontSize='medium'
              onClick={() => onScale(scale + 1)}
            />
            <ZoomOut
              style={{ cursor: 'pointer', color: 'rgba(255, 255, 255, 0.75)' }}
              fontSize='medium'
              onClick={() => onScale(scale - 1)}
            />
            <RotateRight
              style={{ cursor: 'pointer', color: 'white' }}
              fontSize='medium'
              onClick={() => onRotate(rotate + 90)}
            />
          </Box>
        )}
      >
        <Grid container spacing={1}>
          {photos.map((photo, index) => (
            <Grid item xs={6} sm={4} md={2} key={index}>
              <PhotoView src={photo}>
                <img
                  src={photo}
                  alt={`Photo ${index + 1}`}
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    objectFit: 'cover',
                    borderRadius: '4px',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                    cursor: 'pointer',
                  }}
                />
              </PhotoView>
            </Grid>
          ))}
        </Grid>
      </PhotoProvider>

      {/* Buttons: Agree and Issues */}
      {status !== 'Agreed' && (
        <Box
          display='flex'
          justifyContent='center'
          alignItems='center'
          sx={{ mt: '20px', mb: '20px', gap: '10px' }}
        >
          {/* The "Agree" button is always displayed but disabled if issuesFixed = false or status is not "Fixed" */}
          <Button
            variant='contained'
            color='success'
            onClick={handleAgreeClick}
            disabled={status === 'Issues' && !issuesFixed}
          >
            Agree
          </Button>
          <Button variant='contained' color='error' onClick={handleIssuesClick}>
            Issues
          </Button>
        </Box>
      )}

      {/* Agreement confirmation dialog */}
      <Dialog open={openAgreeDialog} onClose={handleCancelAgree}>
        <DialogTitle>Confirm Agreement</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to agree to the photo report{' '}
            {decodeURIComponent(task)} | Base ID:{baseid}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelAgree} color='primary'>
            Cancel
          </Button>
          <Button onClick={handleConfirmAgree} color='primary' autoFocus>
            Agree
          </Button>
        </DialogActions>
      </Dialog>

      {/* Issues Section */}
      {showIssuesFields && (
        <Box mt={4}>
          {newIssues.map((issue, index) => (
            <Box key={index} display='flex' alignItems='center' mb={2}>
              <TextField
                label={`Issue ${index + 1}`}
                value={issue}
                onChange={(e) => handleIssueChange(index, e.target.value)}
                fullWidth
                margin='normal'
              />
              <Tooltip title='Delete'>
                <IconButton
                  onClick={() => confirmRemoveIssue(index)}
                  sx={{ marginLeft: 1 }}
                >
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
          <Box display='flex' justifyContent='space-between' mt={2}>
            <Button
              startIcon={<AddIcon />}
              onClick={handleAddIssueField}
              color='primary'
            >
              Add
            </Button>
            <Box>
              <Button
                variant='contained'
                color='error'
                onClick={handleAddIssuesClick}
                sx={{ marginRight: 1 }}
              >
                {buttonText}
              </Button>
              <Button
                variant='contained'
                color='primary'
                onClick={handleCloseIssuesFields}
                startIcon={<CloseIcon />}
              >
                Close
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {!showIssuesFields && issues.length > 0 && (
        <Box>
          <Typography
            variant='h6'
            gutterBottom
            sx={{ textTransform: 'uppercase', mt: 4 }}
          >
            Issues
          </Typography>
          {/* Displaying events for Issues */}
          {issuesUpdatedEvent ? (
            <Typography variant='body2' gutterBottom>
              Edited by {issuesUpdatedEvent.author} |{' '}
              {new Date(issuesUpdatedEvent.date).toLocaleDateString()}
            </Typography>
          ) : (
            issuesCreatedEvent && (
              <Typography variant='body2' gutterBottom>
                Created by {issuesCreatedEvent.author} |{' '}
                {new Date(issuesCreatedEvent.date).toLocaleDateString()}
              </Typography>
            )
          )}
          {/* Issues Content */}
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Issue</TableCell>
                  <TableCell align='center'>Fixed</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {issues.map((issue, index) => (
                  <TableRow key={index}>
                    <TableCell>{`${index + 1}. ${issue.text}`}</TableCell>
                    <TableCell align='center'>
                      {status === 'Issues' ? (
                        <Checkbox
                          checked={issue.checked}
                          onChange={() => handleCheckboxChange(index)}
                        />
                      ) : issue.checked ? (
                        <CheckIcon color='success' />
                      ) : (
                        <Typography variant='body2' color='textSecondary'>
                          Not Fixed
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {isFixedReady && (
            <Box mt={4}>
              <Typography
                variant='h6'
                gutterBottom
                sx={{ textTransform: 'uppercase' }}
              >
                Upload Fixed Photos
              </Typography>

              {uploadedFiles.length > 0 && (
                <Box mt={2}>
                  <Grid container spacing={2}>
                    {uploadedFiles.map((uploadedFile) => (
                      <Grid item xs={6} sm={4} md={3} key={uploadedFile.id}>
                        <Box
                          sx={{
                            position: 'relative',
                            textAlign: 'center',
                            border: '1px solid #ccc',
                            borderRadius: '8px',
                            padding: 1,
                          }}
                        >
                          <img
                            src={uploadedFile.preview}
                            alt={uploadedFile.file.name}
                            style={{
                              width: '100%',
                              height: 'auto',
                              borderRadius: '8px',
                            }}
                          />
                          <IconButton
                            onClick={() => setFileToDelete(uploadedFile)}
                            sx={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              background: 'rgba(255, 255, 255, 0.8)',
                              '&:hover': {
                                background: 'rgba(255, 255, 255, 1)',
                              },
                            }}
                          >
                            <DeleteIcon />
                          </IconButton>
                          <Typography variant='body2' noWrap>
                            {uploadedFile.file.name}
                          </Typography>
                          {uploading && (
                            <LinearProgress
                              variant='determinate'
                              value={uploadedFile.progress}
                              sx={{ marginTop: 1 }}
                            />
                          )}
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              <Box
                {...getRootProps()}
                sx={{
                  border: '2px dashed #ccc',
                  borderRadius: '8px',
                  padding: 2,
                  textAlign: 'center',
                  marginTop: 2,
                  marginBottom: 2,
                }}
              >
                <input {...getInputProps()} />
                <Typography variant='body1'>
                  Drag & drop images here, or click to select
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginTop: 2,
                }}
              >
                <Button
                  variant='contained'
                  startIcon={<CloudUploadIcon />}
                  color='primary'
                  onClick={handleUploadClick}
                  disabled={uploadedFiles.length === 0 || uploading}
                >
                  Upload Photo
                </Button>
              </Box>
            </Box>
          )}

          {fixedPhotos.length > 0 && (
            <Box mt={4}>
              <Typography
                variant='h6'
                gutterBottom
                sx={{ textTransform: 'uppercase' }}
              >
                Issues Fixed
              </Typography>
              {/* Displaying events for Issues Fixed */}
              {fixedPhotosEvent ? (
                <Typography variant='body2' gutterBottom>
                  Created by {fixedPhotosEvent.author} |{' '}
                  {new Date(fixedPhotosEvent.date).toLocaleDateString()}
                </Typography>
              ) : (
                <Typography variant='body2' gutterBottom color='textSecondary'>
                  No information available.
                </Typography>
              )}
              {/* Fixed Photos Content */}
              <PhotoProvider
                toolbarRender={({ onScale, scale, onRotate, rotate }) => (
                  <Box
                    display='flex'
                    justifyContent='center'
                    alignItems='center'
                    gap={1.5}
                    p={1}
                  >
                    <ZoomIn
                      style={{
                        cursor: 'pointer',
                        color: 'rgba(255, 255, 255, 0.75)',
                      }}
                      fontSize='medium'
                      onClick={() => onScale(scale + 1)}
                    />
                    <ZoomOut
                      style={{
                        cursor: 'pointer',
                        color: 'rgba(255, 255, 255, 0.75)',
                      }}
                      fontSize='medium'
                      onClick={() => onScale(scale - 1)}
                    />
                    <RotateRight
                      style={{ cursor: 'pointer', color: 'white' }}
                      fontSize='medium'
                      onClick={() => onRotate(rotate + 90)}
                    />
                  </Box>
                )}
              >
                <Grid container spacing={1}>
                  {fixedPhotos.map((photo, index) => (
                    <Grid item xs={6} sm={4} md={2} key={`fixed-${index}`}>
                      <PhotoView src={photo}>
                        <img
                          src={photo}
                          alt={`Fixed Photo ${index + 1}`}
                          style={{
                            width: '100%',
                            aspectRatio: '1 / 1',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                            cursor: 'pointer',
                          }}
                        />
                      </PhotoView>
                    </Grid>
                  ))}
                </Grid>
              </PhotoProvider>
            </Box>
          )}

          {/* Displaying agreement message */}
          {agreeMessage && (
            <Box mt={4}>
              <Typography variant='body1' color='success.main'>
                {agreeMessage}
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {status === 'Agreed' && (
        <Box mt={4} display='flex' justifyContent='center'>
          <Button
            variant='contained'
            color='primary'
            startIcon={<CloudDownloadIcon />}
            onClick={handleDownloadReport}
            disabled={downloading}
          >
            {downloading ? 'Downloading...' : 'Download Report'}
          </Button>
        </Box>
      )}

      {/* Confirmation dialog for deleting an issue */}
      <Dialog
        open={confirmDeleteIndex !== null}
        onClose={() => setConfirmDeleteIndex(null)}
      >
        <DialogTitle>Confirmation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this issue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteIndex(null)} color='primary'>
            Cancel
          </Button>
          <Button onClick={handleDeleteIssueField} color='error'>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation dialog for deleting a file */}
      <Dialog open={!!fileToDelete} onClose={() => setFileToDelete(null)}>
        <DialogTitle>Confirmation</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this image?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFileToDelete(null)} color='primary'>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirmed} color='error'>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

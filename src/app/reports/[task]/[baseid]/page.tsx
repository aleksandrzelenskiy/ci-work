'use client';

import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import { ZoomIn, ZoomOut, RotateRight } from '@mui/icons-material';
import { useParams } from 'next/navigation';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';

export default function PhotoReportPage() {
  const { task, baseid } = useParams() as { task: string; baseid: string };

  const [photos, setPhotos] = useState<string[]>([]);
  const [issues, setIssues] = useState<{ text: string; checked: boolean }[]>(
    []
  );
  const [newIssues, setNewIssues] = useState<string[]>(['']);
  const [showIssuesFields, setShowIssuesFields] = useState(false);
  const [buttonText, setButtonText] = useState('Add Issues');
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string>('N/A');
  const [userName, setUserName] = useState<string>('Unknown');

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await fetch(`/api/reports/${task}/${baseid}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch report. Status: ${response.status}`);
        }

        const data = await response.json();
        setPhotos(data.files || []);
        setIssues(
          (data.issues || []).map((issue: string) => ({
            text: issue,
            checked: false,
          }))
        );
        setCreatedAt(new Date(data.createdAt).toLocaleDateString() || 'N/A');
        setUserName(data.userName || 'Unknown');
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
    };

    fetchReport();
  }, [task, baseid]);

  const handleAddIssueField = () => {
    setNewIssues([...newIssues, '']);
  };

  const handleIssueChange = (index: number, value: string) => {
    const updatedNewIssues = [...newIssues];
    updatedNewIssues[index] = value;
    setNewIssues(updatedNewIssues);
  };

  const handleAgreeClick = async () => {
    try {
      const response = await fetch(`/api/reports/${task}/${baseid}`);
      if (!response.ok) {
        throw new Error('Failed to fetch current status.');
      }
      const data = await response.json();

      if (data.status === 'Agreed') {
        alert(
          `Photo report ${decodeURIComponent(
            task
          )} | Base: ${decodeURIComponent(baseid)} has already been agreed.`
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

      alert('Status has been updated to Agreed.');
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status. Please try again.');
    }
  };

  const handleDeleteIssueField = async () => {
    if (confirmDeleteIndex === null) return;

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

      // Обновляем состояния `issues` и `newIssues`
      const updatedIssues = [...issues];
      const updatedNewIssues = [...newIssues];

      updatedIssues.splice(confirmDeleteIndex, 1);
      updatedNewIssues.splice(confirmDeleteIndex, 1);

      setIssues(updatedIssues);
      setNewIssues(updatedNewIssues);
      setConfirmDeleteIndex(null);
    } catch (error) {
      console.error('Error deleting issue:', error);
      alert('Failed to delete issue. Please try again.');
    }
  };

  const handleCheckboxChange = (index: number) => {
    const updatedIssues = [...issues];
    updatedIssues[index].checked = !updatedIssues[index].checked;
    setIssues(updatedIssues);
  };

  const areAllIssuesFixed = (): boolean => {
    return issues.every((issue) => issue.checked);
  };

  const handleIssuesClick = () => {
    const currentIssuesTexts = issues.map((issue) => issue.text);
    setNewIssues(currentIssuesTexts.length > 0 ? currentIssuesTexts : ['']);
    setShowIssuesFields(true);
    setButtonText(issues.length > 0 ? 'Update' : 'Add Issues');
  };

  const handleAddIssuesClick = async () => {
    const currentIssues = issues.map((issue) => issue.text); // Текущие замечания из базы
    const filteredNewIssues = newIssues.filter((issue) => issue.trim() !== ''); // Убираем пустые строки

    // Проверяем изменения
    const addedIssues = filteredNewIssues.filter(
      (issue) => !currentIssues.includes(issue)
    );
    const updatedIssues = filteredNewIssues.filter(
      (issue, index) => currentIssues[index] !== issue
    );
    const deletedIssues = currentIssues.filter(
      (issue) => !filteredNewIssues.includes(issue)
    );

    // Если ничего не изменилось
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

      setIssues(
        filteredNewIssues.map((issue) => ({ text: issue, checked: false }))
      );
      setShowIssuesFields(false);
      setNewIssues(['']);
    } catch (error) {
      console.error('Error updating issues:', error);
      alert('Failed to update issues. Please try again.');
    }
  };

  const handleCloseIssuesFields = () => {
    setShowIssuesFields(false);
    setNewIssues(['']);
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

  return (
    <Box>
      <Typography gutterBottom>
        {decodeURIComponent(task)} | Base ID: {decodeURIComponent(baseid)}
      </Typography>
      <Typography variant='body2' gutterBottom>
        Created At: {createdAt} | Author: {userName}
      </Typography>
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
      <Box mt={4} display='flex' justifyContent='center' gap={2}>
        <Button variant='contained' color='success' onClick={handleAgreeClick}>
          Agreed
        </Button>
        <Button variant='contained' color='error' onClick={handleIssuesClick}>
          Issues
        </Button>
      </Box>
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
              <IconButton
                onClick={() => setConfirmDeleteIndex(index)}
                sx={{ marginLeft: 1 }}
              >
                <DeleteIcon />
              </IconButton>
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
        <Box mt={4}>
          <Typography variant='h6' gutterBottom>
            Issues
          </Typography>
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
                      <Checkbox
                        checked={issue.checked}
                        onChange={() => handleCheckboxChange(index)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box mt={2} display='flex' justifyContent='center'>
            <Button
              variant='contained'
              color='primary'
              disabled={!areAllIssuesFixed()}
            >
              Add Photo
            </Button>
          </Box>
        </Box>
      )}
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
    </Box>
  );
}

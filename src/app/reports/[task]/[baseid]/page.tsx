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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import { ZoomIn, ZoomOut, RotateRight } from '@mui/icons-material';
import { useParams } from 'next/navigation';
import { useDropzone, Accept } from 'react-dropzone';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';

// Интерфейс для управления загружаемыми файлами
interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  progress: number;
}

export default function PhotoReportPage() {
  const { task, baseid } = useParams() as { task: string; baseid: string };

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
  const [createdAt, setCreatedAt] = useState<string>('N/A');
  const [userName, setUserName] = useState<string>('Unknown');
  const [uploading, setUploading] = useState(false);

  // Для очистки URL-адресов объектов
  useEffect(() => {
    return () => {
      uploadedFiles.forEach((file) => URL.revokeObjectURL(file.preview));
    };
  }, [uploadedFiles]);

  // Загружаем отчет из базы
  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await fetch(`/api/reports/${task}/${baseid}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch report. Status: ${response.status}`);
        }

        const data = await response.json();
        setPhotos(data.files || []);
        setFixedPhotos(data.fixedFiles || []);
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

  // Удаление замечаний (по индексу)
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

    // Оптимистичное удаление из интерфейса
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
      alert('Failed to delete issue. Please try again.');
      // В случае ошибки откатываем
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

  // Обработка файлов при дропе
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
          alert(`Error: ${error.message}`);
        });
      });
    },
  });

  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
  };

  // Состояние для удаления файлов (fixed)
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

  /**
   * Главное изменение:
   * Теперь мы отправляем все файлы ОДНИМ запросом,
   * вместо цикла Promise.all по каждому файлу.
   */
  const handleUploadClick = async () => {
    if (uploadedFiles.length === 0) {
      alert('Please select images to upload.');
      return;
    }

    setUploading(true);

    try {
      // Формируем общий FormData
      const formData = new FormData();
      formData.append('baseId', baseid);
      formData.append('task', task);

      // Добавляем все файлы
      for (const uploadedFile of uploadedFiles) {
        formData.append('image[]', uploadedFile.file);
      }

      // Один XMLHttpRequest для всех файлов
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload/fixed', true);

      // Если хотим общий прогресс по всем файлам - показываем одинаковый % для всех
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const totalProgress = (event.loaded / event.total) * 100;
          // Присваиваем всем файлам одинаковый прогресс (например)
          setUploadedFiles((prevFiles) =>
            prevFiles.map((f) => ({ ...f, progress: totalProgress }))
          );
        }
      };

      xhr.onload = async () => {
        if (xhr.status === 200) {
          alert('Fixed photo uploaded successfully.');
          setUploadedFiles([]);
          setIsFixedReady(false);

          // Обновляем список фотографий
          const response = await fetch(`/api/reports/${task}/${baseid}`);
          if (response.ok) {
            const data = await response.json();
            setPhotos(data.files || []);
            setFixedPhotos(data.fixedFiles || []);
          }
        } else {
          alert('Failed to upload image(s).');
        }
        setUploading(false);
      };

      xhr.onerror = () => {
        alert('An error occurred during the upload.');
        setUploading(false);
      };

      xhr.send(formData);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Error uploading files.');
      setUploading(false);
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
        <Typography variant='h6' gutterBottom sx={{ mt: 4 }}>
          Photo Report
        </Typography>
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

      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        sx={{ mt: '20px', mb: '20px', gap: '10px' }}
      >
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
                onClick={() => confirmRemoveIssue(index)}
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
        <Box>
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

          {isFixedReady && (
            <Box mt={4}>
              <Typography variant='h6'>Upload Fixed Photos</Typography>

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
              <Typography variant='h6' gutterBottom>
                Issues Fixed
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
        </Box>
      )}

      {/* Диалог подтверждения удаления замечания */}
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

      {/* Диалог подтверждения удаления файла */}
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

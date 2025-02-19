// app/upload/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  TextField,
  Button,
  Box,
  Grid,
  IconButton,
  LinearProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Checkbox,
  FormControlLabel,
  Alert,
  Snackbar,
  CircularProgress,
  Link,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useDropzone } from 'react-dropzone';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  progress: number;
  uploading?: boolean;
}

interface BaseStation {
  id: string;
  number: string;
  files: UploadedFile[];
  uploadProgress: number;
  isUploading: boolean;
  isUploaded?: boolean;
  uploadedCount?: number;
}

const DropzoneArea = ({
  onDrop,
  label,
}: {
  onDrop: (files: File[]) => void;
  label: string;
}) => {
  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  return (
    <Box
      {...getRootProps()}
      sx={{
        border: '2px dashed #ccc',
        borderRadius: '8px',
        p: 2,
        textAlign: 'center',
        mb: 2,
        cursor: 'pointer',
      }}
    >
      <input {...getInputProps()} />
      <Typography>{label}</Typography>
    </Box>
  );
};

export default function UploadPage() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get('taskId');
  const taskNameParam = searchParams.get('taskName');
  const bsNumberParam = searchParams.get('bsNumber');
  const executorName = searchParams.get('executorName');
  const executorId = searchParams.get('executorId');
  const initiatorName = searchParams.get('initiatorName');
  const initiatorId = searchParams.get('initiatorId');

  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [baseStations, setBaseStations] = useState<BaseStation[]>([]);
  const [task, setTask] = useState('');
  const [isCheckboxChecked, setIsCheckboxChecked] = useState(false);
  const [isAccordionExpanded, setIsAccordionExpanded] = useState(true);
  const [fileToDelete, setFileToDelete] = useState<{
    bsId: string;
    file: UploadedFile;
  } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (taskNameParam && bsNumberParam) {
      const decodedTask = decodeURIComponent(taskNameParam);
      const decodedBS = decodeURIComponent(bsNumberParam);
      setTask(`${decodedTask} | ${decodedBS}`);

      const bsNumbers = decodedBS.split('-');
      const stations = bsNumbers.map((num, index) => ({
        id: `bs-${index}-${Date.now()}`,
        number: num.trim(),
        files: [],
        uploadProgress: 0,
        isUploading: false,
        isUploaded: false,
      }));
      setBaseStations(stations);
    }
  }, [taskNameParam, bsNumberParam]);

  useEffect(() => {
    if (isCheckboxChecked) {
      setIsAccordionExpanded(false);
    }
  }, [isCheckboxChecked]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/auth/login');
    }
  }, [isLoaded, isSignedIn, router]);

  const handleDrop = (bsId: string, acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      id: `${Date.now()}-${file.name}`,
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
    }));

    setBaseStations((prev) =>
      prev.map((bs) =>
        bs.id === bsId
          ? { ...bs, files: [...bs.files, ...newFiles], isUploaded: false }
          : bs
      )
    );
  };

  const handleRemoveFile = (bsId: string, fileId: string) => {
    setBaseStations((prev) =>
      prev.map((bs) =>
        bs.id === bsId
          ? { ...bs, files: bs.files.filter((f) => f.id !== fileId) }
          : bs
      )
    );
  };

  const confirmRemoveFile = (bsId: string, file: UploadedFile) => {
    setFileToDelete({ bsId, file });
  };

  const handleDeleteConfirmed = () => {
    if (fileToDelete) {
      handleRemoveFile(fileToDelete.bsId, fileToDelete.file.id);
      setFileToDelete(null);
    }
  };

  const handleUpload = async (bsId: string) => {
    const bs = baseStations.find((bs) => bs.id === bsId);
    if (!bs || bs.files.length === 0) return;

    try {
      const formData = new FormData();
      formData.append('baseId', bs.number);
      formData.append('task', task);
      formData.append('taskId', taskId || 'unknown');
      formData.append('executorId', executorId || 'unknown');
      formData.append('executorName', executorName || 'unknown');
      formData.append('initiatorId', initiatorId || 'unknown');
      formData.append('initiatorName', initiatorName || 'unknown');

      bs.files.forEach((file) => {
        formData.append('image[]', file.file);
      });

      setBaseStations((prev) =>
        prev.map((prevBs) =>
          prevBs.id === bsId
            ? {
                ...prevBs,
                files: prevBs.files.map((f) => ({ ...f, uploading: true })),
                isUploading: true,
                uploadProgress: 0,
              }
            : prevBs
        )
      );

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const totalProgress = (event.loaded / event.total) * 100;
          setBaseStations((prev) =>
            prev.map((prevBs) => {
              if (prevBs.id === bsId) {
                const files = prevBs.files.map((f) => ({
                  ...f,
                  progress: Math.min(totalProgress, 99),
                }));
                return {
                  ...prevBs,
                  files,
                  uploadProgress: totalProgress,
                };
              }
              return prevBs;
            })
          );
        }
      };

      await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            setBaseStations((prev) =>
              prev.map((prevBs) =>
                prevBs.id === bsId
                  ? {
                      ...prevBs,
                      files: [],
                      isUploading: false,
                      uploadProgress: 100,
                      isUploaded: true,
                      uploadedCount: prevBs.files.length,
                    }
                  : prevBs
              )
            );
            setSuccessMessage(`Files for ${bs.number} uploaded successfully!`);
            resolve(xhr.response);
          } else {
            reject(new Error('Upload failed'));
          }
        };
        xhr.onerror = () => {
          reject(new Error('Upload error'));
          setErrorMessage(`Error uploading files for ${bs.number}`);
        };
        xhr.send(formData);
      });
    } catch (error) {
      console.error('Upload error:', error);
      setErrorMessage(`Error uploading files for ${bs.number}`);
      setBaseStations((prev) =>
        prev.map((prevBs) =>
          prevBs.id === bsId
            ? {
                ...prevBs,
                files: prevBs.files.map((f) => ({
                  ...f,
                  uploading: false,
                })),
                isUploading: false,
                uploadProgress: 0,
              }
            : prevBs
        )
      );
    }
  };

  if (!isLoaded) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity='success' sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!errorMessage}
        autoHideDuration={4000}
        onClose={() => setErrorMessage(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity='error' sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Accordion
            expanded={isAccordionExpanded}
            onChange={(_, isExpanded) => setIsAccordionExpanded(isExpanded)}
            defaultExpanded
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant='h6'>Photo Report Requirements</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ mt: 3, mb: 3 }}>
                <Alert variant='outlined' severity='info'>
                  Confirm compliance with photo report requirements
                </Alert>
              </Box>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={isCheckboxChecked}
                    onChange={(e) => setIsCheckboxChecked(e.target.checked)}
                  />
                }
                label='All photos meet the specified requirements'
              />
            </AccordionDetails>
          </Accordion>
        </Grid>

        {isCheckboxChecked && (
          <Grid item xs={12} md={6}>
            <Paper>
              <Box sx={{ padding: 2 }}>
                <Typography variant='h5' gutterBottom>
                  Upload Photos
                </Typography>
                <TextField
                  fullWidth
                  label='Task'
                  value={task}
                  InputProps={{ readOnly: true }}
                  margin='normal'
                />

                {baseStations.map((bs) => (
                  <Box key={bs.id} sx={{ mb: 4 }}>
                    <Box display='flex' alignItems='center' gap={1}>
                      <Typography variant='h6' gutterBottom>
                        Base Station: {bs.number}
                      </Typography>
                      {bs.isUploaded && (
                        <CheckCircleIcon color='success' fontSize='small' />
                      )}
                    </Box>

                    {bs.isUploaded && (
                      <Box sx={{ mb: 2 }}>
                        <Typography
                          variant='body2'
                          color='text.secondary'
                          gutterBottom
                        >
                          Uploaded files: {bs.uploadedCount}
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ marginBottom: 3 }}>
                      <Grid container spacing={2}>
                        {bs.files.map((file) => (
                          <Grid item xs={6} sm={4} md={3} key={file.id}>
                            <Box
                              sx={{
                                position: 'relative',
                                textAlign: 'center',
                              }}
                            >
                              <img
                                src={file.preview}
                                alt={file.file.name}
                                style={{
                                  width: '100%',
                                  height: 'auto',
                                  borderRadius: '8px',
                                  opacity: file.uploading ? 0.6 : 1,
                                }}
                              />
                              <IconButton
                                onClick={() => confirmRemoveFile(bs.id, file)}
                                sx={{
                                  position: 'absolute',
                                  top: 8,
                                  right: 8,
                                  bgcolor: 'background.paper',
                                }}
                                disabled={file.uploading}
                              >
                                <DeleteIcon />
                              </IconButton>
                              <Typography variant='body2' noWrap>
                                {file.file.name}
                              </Typography>
                              {file.uploading && (
                                <LinearProgress
                                  variant='determinate'
                                  value={file.progress}
                                  sx={{ mt: 1 }}
                                />
                              )}
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>

                    <DropzoneArea
                      onDrop={(files) => handleDrop(bs.id, files)}
                      label={`Drag & drop files for ${bs.number} or click to browse`}
                    />

                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <Button
                        variant='contained'
                        startIcon={
                          bs.isUploading ? (
                            <CircularProgress
                              size={20}
                              color='inherit'
                              variant={
                                bs.uploadProgress > 0
                                  ? 'determinate'
                                  : 'indeterminate'
                              }
                              value={bs.uploadProgress}
                            />
                          ) : (
                            <CloudUploadIcon />
                          )
                        }
                        onClick={() => handleUpload(bs.id)}
                        disabled={bs.files.length === 0 || bs.isUploading}
                        sx={{ mt: 2 }}
                      >
                        {bs.isUploading
                          ? `Uploading... ${Math.round(bs.uploadProgress)}%`
                          : `Upload ${bs.number}`}
                      </Button>
                    </Box>
                  </Box>
                ))}

                <Dialog
                  open={!!fileToDelete}
                  onClose={() => setFileToDelete(null)}
                >
                  <DialogTitle>Confirm Delete</DialogTitle>
                  <DialogContent>
                    <DialogContentText>
                      Are you sure you want to delete this file?
                    </DialogContentText>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => setFileToDelete(null)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleDeleteConfirmed}
                      color='error'
                      autoFocus
                    >
                      Delete
                    </Button>
                  </DialogActions>
                </Dialog>
                <Box sx={{ mt: 4, mb: 1, textAlign: 'center' }}>
                  <Link href={`/tasks/${taskId?.toLowerCase()}`}>
                    <Button variant='contained' color='primary'>
                      Back to Task
                    </Button>
                  </Link>
                </Box>
              </Box>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

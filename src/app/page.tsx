'use client';

import React, { useState } from 'react';
import {
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
} from '@mui/material';
import { useDropzone } from 'react-dropzone';
import DeleteIcon from '@mui/icons-material/Delete';

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  progress: number;
}

export default function PhotoUploader() {
  const [baseId, setBaseId] = useState('');
  const [task, setTask] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [fileToDelete, setFileToDelete] = useState<UploadedFile | null>(null);

  const onDrop = (acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      id: `${Date.now()}-${file.name}`,
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
    }));
    setFiles((prevFiles) => [...prevFiles, ...newFiles]);
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  const handleRemoveFile = (id: string) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
  };

  const confirmRemoveFile = (file: UploadedFile) => {
    setFileToDelete(file);
  };

  const handleDeleteConfirmed = () => {
    if (fileToDelete) {
      handleRemoveFile(fileToDelete.id);
    }
    setFileToDelete(null);
  };

  const handleUploadClick = async () => {
    if (!baseId || !task || files.length === 0) {
      alert('Please fill all fields and select images to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('baseId', baseId);
    formData.append('task', task);

    files.forEach((file) => {
      formData.append('image[]', file.file);
    });

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          setFiles((prevFiles) =>
            prevFiles.map((file) => ({
              ...file,
              progress: progress,
            }))
          );
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          alert('Images uploaded successfully!');
          setFiles([]);
          setBaseId('');
          setTask('');
        } else {
          alert('Failed to upload images');
        }
      };

      xhr.onerror = () => {
        alert('An error occurred while uploading images.');
      };

      xhr.send(formData);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Error uploading files.');
    }
  };

  return (
    <Box sx={{ padding: 2 }}>
      <Typography variant='h4' gutterBottom>
        Upload Images to Photo Report
      </Typography>

      <TextField
        fullWidth
        label='Task'
        value={task}
        onChange={(e) => setTask(e.target.value)}
        margin='normal'
      />
      <TextField
        fullWidth
        label='Base ID'
        value={baseId}
        onChange={(e) => setBaseId(e.target.value)}
        margin='normal'
      />
      <Box sx={{ marginBottom: 3 }}>
        <Grid container spacing={2}>
          {files.map((uploadedFile) => (
            <Grid item xs={6} sm={4} md={3} key={uploadedFile.id}>
              <Box sx={{ position: 'relative', textAlign: 'center' }}>
                <img
                  src={uploadedFile.preview}
                  alt={uploadedFile.file.name}
                  style={{ width: '100%', height: 'auto', borderRadius: '8px' }}
                />
                <IconButton
                  onClick={() => confirmRemoveFile(uploadedFile)}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: 'rgba(255, 255, 255, 0.8)',
                    '&:hover': { background: 'rgba(255, 255, 255, 1)' },
                  }}
                >
                  <DeleteIcon />
                </IconButton>
                <Typography variant='body2' noWrap>
                  {uploadedFile.file.name}
                </Typography>
                <LinearProgress
                  variant='determinate'
                  value={uploadedFile.progress}
                  sx={{ marginTop: 1 }}
                />
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed #ccc',
          borderRadius: '8px',
          padding: 2,
          textAlign: 'center',
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
          marginTop: 5,
        }}
      >
        <Button
          variant='contained'
          color='primary'
          onClick={handleUploadClick}
          disabled={!baseId || !task || files.length === 0}
        >
          Upload Images
        </Button>
      </Box>

      {/* Диалог подтверждения удаления */}
      <Dialog
        open={!!fileToDelete}
        onClose={() => setFileToDelete(null)}
        aria-labelledby='confirm-delete-title'
      >
        <DialogTitle id='confirm-delete-title'>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this image?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFileToDelete(null)} color='primary'>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirmed} color='secondary' autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

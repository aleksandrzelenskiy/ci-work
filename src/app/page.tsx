'use client';

import React, { useState } from 'react';
import {
  Typography,
  TextField,
  Button,
  Box,
  Grid,
  IconButton,
} from '@mui/material';
import { useDropzone } from 'react-dropzone';
import DeleteIcon from '@mui/icons-material/Delete';

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
}

export default function UploadPage() {
  const [baseId, setBaseId] = useState('');
  const [task, setTask] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const onDrop = (acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      id: `${Date.now()}-${file.name}`,
      file,
      preview: URL.createObjectURL(file),
    }));
    setFiles((prevFiles) => [...prevFiles, ...newFiles]);
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  const handleRemoveFile = (id: string) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
  };

  const handleUpload = async () => {
    if (!baseId || !task || files.length === 0) {
      alert('Please fill all fields and select images to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('baseId', baseId);
    formData.append('task', task);

    files.forEach((uploadedFile, index) => {
      formData.append(`image-${index}`, uploadedFile.file);
    });

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        alert('Images uploaded successfully!');
        setFiles([]);
        setBaseId('');
        setTask('');
      } else {
        console.error(result.error || 'Error uploading images');
        alert('Error uploading images.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error uploading images.');
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
                onClick={() => handleRemoveFile(uploadedFile.id)}
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
            </Box>
          </Grid>
        ))}
      </Grid>

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
          onClick={handleUpload}
          disabled={!baseId || !task || files.length === 0}
        >
          Upload Images
        </Button>
      </Box>
    </Box>
  );
}

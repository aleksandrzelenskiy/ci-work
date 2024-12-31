'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Box, CircularProgress, Typography, Grid } from '@mui/material';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import 'react-photo-view/dist/react-photo-view.css';
import { ZoomIn, ZoomOut, RotateRight } from '@mui/icons-material';

export default function PhotoReportPage() {
  const { task, baseid } = useParams() as { task: string; baseid: string };
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        const response = await fetch(`/api/reports/${task}/${baseid}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch photos. Status: ${response.status}`);
        }

        const data = await response.json();
        if (!data.files || !Array.isArray(data.files)) {
          throw new Error('Invalid data format received');
        }

        setPhotos(data.files);
      } catch (err: unknown) {
        console.error('Error fetching photos:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load photos. Please try again later.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPhotos();
  }, [task, baseid]);

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
        {task} | Base ID: {baseid}
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
    </Box>
  );
}

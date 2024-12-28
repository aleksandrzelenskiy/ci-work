import React, { useState } from 'react';
import { Box, Button, Typography, TextField, Grid } from '@mui/material';
import ExifReader from 'exifreader';

interface GeoData {
  latitude?: number;
  longitude?: number;
  altitude?: number;
}

export default function GeoDataExtractor() {
  const [file, setFile] = useState<File | null>(null);
  const [geoData, setGeoData] = useState<GeoData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
    setGeoData(null);
    setError(null);
  };

  const handleExtractGeoData = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer());

      const tags = ExifReader.load(buffer);

      // Извлекаем координаты и высоту
      const latitude = tags.GPSLatitude?.description as number | undefined;
      const longitude = tags.GPSLongitude?.description as number | undefined;
      const altitude = tags.GPSAltitude?.description as number | undefined;

      setGeoData({ latitude, longitude, altitude });
    } catch (err) {
      console.error('Error extracting geo data:', err);
      setError('Failed to extract geo data');
    }
  };

  return (
    <Box sx={{ padding: 2 }}>
      <Typography variant='h5' gutterBottom>
        GeoData Extractor
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            type='file'
            inputProps={{ accept: 'image/jpeg, image/jpg' }}
            onChange={handleFileChange}
            fullWidth
          />
        </Grid>
        <Grid item xs={12}>
          <Button
            variant='contained'
            color='primary'
            onClick={handleExtractGeoData}
            disabled={!file}
          >
            Extract GeoData
          </Button>
        </Grid>
        {geoData && (
          <Grid item xs={12}>
            <Typography variant='body1'>
              <strong>Latitude:</strong> {geoData.latitude || 'N/A'}
            </Typography>
            <Typography variant='body1'>
              <strong>Longitude:</strong> {geoData.longitude || 'N/A'}
            </Typography>
            <Typography variant='body1'>
              <strong>Altitude:</strong> {geoData.altitude || 'N/A'}
            </Typography>
          </Grid>
        )}
        {error && (
          <Grid item xs={12}>
            <Typography variant='body1' color='error'>
              {error}
            </Typography>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

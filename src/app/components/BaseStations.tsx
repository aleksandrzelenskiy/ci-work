// app/components/BaseStation.tsx

'use client';

import React, { useEffect, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Snackbar from '@mui/material/Snackbar';
import {
  YMaps,
  Map,
  Placemark,
  FullscreenControl,
  TypeSelector,
  ZoomControl,
} from '@pbe/react-yandex-maps';

export interface BaseStation {
  _id: string;
  name: string;
  coordinates: string;
  address?: string;
}

export default function BaseStations() {
  const [baseStations, setBaseStations] = useState<BaseStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<BaseStation | null>(
    null
  );
  const [editStation, setEditStation] = useState<BaseStation | null>(null);
  const [importResult, setImportResult] = useState<null | {
    message: string;
    inserted: number;
    updated: number;
    skipped: number;
    duplicatesInFile: number;
    notFound?: Array<{ lat: string; lon: string; name?: string }>; // теперь опционально
  }>(null);

  const [importing, setImporting] = useState(false);
  const [newStation, setNewStation] = useState({ name: '', coordinates: '', address: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [openSaveDialog, setOpenSaveDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);



  useEffect(() => {
    const fetchStations = async () => {
      try {
        const response = await fetch('/api/bs');
        const data = await response.json();
        setBaseStations(data);
      } catch (err) {
        console.error('Fetch stations error:', err);
        setError('Failed to load base stations');
      }
    };
    void fetchStations();
  }, []);


  const handleImportKmz = async (file: File) => {
    setError('');
    setSuccess('');
    setImportResult(null);
    setImporting(true);

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch('/api/bs/import', {
        method: 'POST',
        body: fd,
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json?.message || 'Import failed');
        setImporting(false);
        return;
      }

      // единый сет с безопасным notFound
      setImportResult({ ...json, notFound: json.notFound ?? [] });

      // обновляем список БС
      const refreshed = await fetch('/api/bs');
      const data = await refreshed.json();
      setBaseStations(data);

      setSuccess('KMZ импортирован');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'KMZ import error';
      setError(msg);
    } finally {
      setImporting(false);
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleImportKmz(f);
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleImportKmz(f);
  };


  const handleOpenSaveDialog = () => {
    setOpenSaveDialog(true);
  };

  const handleCloseSaveDialog = () => {
    setOpenSaveDialog(false);
  };

  const handleOpenDeleteDialog = () => {
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/bs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newStation),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData?.message || 'Create error');
        return;
      }


      const createdStation = await response.json();
      setBaseStations([...baseStations, createdStation]);
      setNewStation({ name: '', coordinates: '', address: '' });
      setSuccess(`Base station ${createdStation.name} added successfully`);
    } catch (err) {
      console.error('Submission error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const startEditing = () => {
    if (selectedStation) {
      setEditStation({ ...selectedStation });
      setIsEditing(true);
    }
  };

  const handleUpdate = async () => {
    if (!editStation) return;
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/bs/${editStation._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editStation),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData?.message || 'Update error');
        return;
      }


      const updatedStation = await response.json();
      setBaseStations(
        baseStations.map((st) =>
          st._id === updatedStation._id ? updatedStation : st
        )
      );
      setSelectedStation(updatedStation);
      setIsEditing(false);
      setSuccess(`Base station ${updatedStation.name} updated successfully`);
      setOpenSaveDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update error');
    }
  };

  const handleCloseEditing = () => {
    setIsEditing(false);
    setEditStation(null);
  };

  const handleDelete = async () => {
    if (!selectedStation) return;
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/bs/${selectedStation._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData?.message || 'Update error');
        return;
      }


      setBaseStations(
        baseStations.filter((st) => st._id !== selectedStation._id)
      );
      setSelectedStation(null);
      setIsEditing(false);
      setSuccess(`Base station ${selectedStation.name} deleted successfully`);
      setOpenDeleteDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete error');
    }
  };

  return (
    <Box sx={{ maxWidth: 600, margin: 'auto', p: 2 }}>
      <Autocomplete
        options={baseStations}
        getOptionLabel={(option) => option.name}
        value={selectedStation}
        isOptionEqualToValue={(option, value) => option._id === value._id}
        onChange={(_, newValue) => {
          setSelectedStation(newValue);
          setIsEditing(false);
        }}
        renderInput={(params) => (
          <TextField {...params} label='Select base station' fullWidth />
        )}
        sx={{ mb: 3 }}
      />

      {selectedStation && !isEditing && (
        <Box sx={{ mb: 3 }}>
          <Typography variant='body1'>
            Station: {selectedStation.name}
          </Typography>
          <Typography variant='body1' sx={{ mb: 2 }}>
            Coordinates: {selectedStation.coordinates}
          </Typography>

          {selectedStation.address && (
              <Typography variant='body1' sx={{ mt: -1, mb: 2 }}>
                Address: {selectedStation.address}
              </Typography>
          )}

          <Box
            sx={{
              height: 300,
              width: '100%',
              mb: 2,
              borderRadius: 1,
              overflow: 'hidden',
              boxShadow: 1,
            }}
          >
            <YMaps
                query={{ apikey: process.env.NEXT_PUBLIC_YANDEX_MAPS_APIKEY, lang: 'ru_RU' }}
            >
              <Map
                  state={{
                    center: selectedStation.coordinates.split(' ').map(Number),
                    zoom: 14,
                    // было: 'yandex#satellite'
                    type: 'yandex#hybrid',
                  }}
                  width="100%"
                  height="100%"
                  options={{
                    suppressMapOpenBlock: true, // без «лишних» попапов
                  }}
              >
                <Placemark
                    geometry={selectedStation.coordinates.split(' ').map(Number)}
                    options={{
                      preset: 'islands#blueStretchyIcon',
                      iconColor: '#ff0000',
                    }}
                    properties={{
                      balloonContent: selectedStation.name,
                    }}
                />

                {/* @pbe/react-yandex-maps */}
                <FullscreenControl />
                <TypeSelector />        {/* выбор «Схема / Спутник / Гибрид» */}
                <ZoomControl />         {/* плюс/минус масштаб */}
                {/* <TrafficControl />  // дорожная ситуация с подписями */}
                {/* <SearchControl options={{ float: 'right' }} /> */}
                {/* <GeolocationControl /> */}
              </Map>
            </YMaps>

          </Box>

          <Button
            startIcon={<EditIcon />}
            variant='outlined'
            onClick={startEditing}
          >
            Edit
          </Button>
        </Box>
      )}

      {isEditing && editStation && (
        <Box sx={{ mb: 3 }}>
          <Typography variant='h6' sx={{ mb: 2 }}>
            Edit Station
          </Typography>
          <TextField
            label='BS Number'
            fullWidth
            value={editStation.name}
            onChange={(e) =>
              setEditStation({ ...editStation, name: e.target.value })
            }
            sx={{ mb: 2 }}
          />
          <TextField
            label='Coordinates'
            fullWidth
            value={editStation.coordinates}
            onChange={(e) => {
              const newCoords = e.target.value;
              setEditStation({ ...editStation, coordinates: newCoords });
            }}
            sx={{ mb: 2 }}
          />

          <TextField
              label='Address'
              fullWidth
              value={editStation.address || ''}
              onChange={(e) =>
                  setEditStation({ ...editStation, address: e.target.value })
              }
              sx={{ mb: 2 }}
          />


          <Button
            variant='contained'
            onClick={handleOpenSaveDialog}
            sx={{ mr: 2 }}
          >
            Save
          </Button>

          <Button
            variant='outlined'
            onClick={handleCloseEditing}
            sx={{ mr: 2 }}
          >
            Close
          </Button>

          <Button
            startIcon={<DeleteIcon />}
            variant='outlined'
            color='error'
            onClick={handleOpenDeleteDialog}
          >
            Delete
          </Button>
        </Box>
      )}

      <Dialog
        open={openSaveDialog}
        onClose={handleCloseSaveDialog}
        aria-labelledby='alert-dialog-title'
        aria-describedby='alert-dialog-description'
      >
        <DialogTitle id='alert-dialog-title'>{'Confirm Save'}</DialogTitle>
        <DialogContent>
          <DialogContentText id='alert-dialog-description'>
            Are you sure you want to save changes to this base station?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSaveDialog} color='primary'>
            Cancel
          </Button>
          <Button onClick={handleUpdate} color='primary' autoFocus>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openDeleteDialog}
        onClose={handleCloseDeleteDialog}
        aria-labelledby='alert-dialog-title'
        aria-describedby='alert-dialog-description'
      >
        <DialogTitle id='alert-dialog-title'>{'Confirm Delete'}</DialogTitle>
        <DialogContent>
          <DialogContentText id='alert-dialog-description'>
            Are you sure you want to delete this base station? This action
            cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog} color='primary'>
            Cancel
          </Button>
          <Button onClick={handleDelete} color='error' autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
          open={Boolean(error)}
          autoHideDuration={4000}
          onClose={() => setError('')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
            onClose={() => setError('')}
            severity="error"
            variant="filled"
            sx={{ width: '100%' }}
        >
          {error || ''}
        </Alert>
      </Snackbar>

      <Snackbar
          open={Boolean(success)}
          autoHideDuration={4000}
          onClose={() => setSuccess('')}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
            onClose={() => setSuccess('')}
            severity="success"
            variant="filled"
            sx={{ width: '100%' }}
        >
          {success || ''}
        </Alert>
      </Snackbar>



      <form onSubmit={handleSubmit}>
        <Typography variant='h6' sx={{ mb: 2 }}>
          Add new base station
        </Typography>

        <TextField
          label='BS Number'
          fullWidth
          value={newStation.name}
          onChange={(e) =>
            setNewStation({ ...newStation, name: e.target.value })
          }
          sx={{ mb: 2 }}
        />

        <TextField
          label='Coordinates (latitude longitude)'
          fullWidth
          value={newStation.coordinates}
          onChange={(e) =>
            setNewStation({ ...newStation, coordinates: e.target.value })
          }
          sx={{ mb: 2 }}
        />

        <TextField
            label='Address'
            fullWidth
            value={newStation.address}
            onChange={(e) =>
                setNewStation({ ...newStation, address: e.target.value })
            }
            sx={{ mb: 2 }}
        />


        <Box sx={{ textAlign: 'center' }}>
          <Button type='submit' variant='contained' color='primary'>
            Add BS
          </Button>
        </Box>
      </form>
      {/* Drag & Drop KMZ */}
      <Box
          sx={{
            mt: 3,
            p: 3,
            border: '2px dashed',
            borderColor: dragActive ? 'primary.main' : 'divider',
            borderRadius: 1.5,
            textAlign: 'center',
            bgcolor: dragActive ? 'action.hover' : 'background.paper',
            cursor: 'pointer',
            transition: 'all .15s ease-in-out',
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
      >
        <Typography variant="h6" sx={{ mb: 1 }}>
          Import KMZ
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          Drag & drop a <code>.kmz</code> file here, or click to select
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          Drag & drop a <code>.kmz</code> file here, or click to select
        </Typography>

        <input
            ref={fileInputRef}
            type="file"
            accept=".kmz"
            hidden
            onChange={onPickFile}
        />

        <Button disabled={importing} variant="outlined">
          {importing ? 'Import…' : 'Select KMZ'}
        </Button>

        {importResult && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="info" sx={{ mb: 1 }}>
                {importResult.message}. Inserted: {importResult.inserted}. Updated: {importResult.updated}. Skipped: {importResult.skipped}. Duplicates in file: {importResult.duplicatesInFile}.
              </Alert>

              {(importResult.notFound?.length ?? 0) > 0 && (
                  <Box sx={{ maxHeight: 180, overflow: 'auto', p: 1, border: '1px solid #eee', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Items not matched in DB (coordinates mismatch):
                    </Typography>
                    {(importResult.notFound ?? []).map((x, i) => (
                        <Typography key={i} variant="caption" display="block">
                          {x.name ? `${x.name} — ` : ''}{x.lat} {x.lon}
                        </Typography>
                    ))}
                  </Box>
              )}
            </Box>
        )}
      </Box>

    </Box>
  );
}

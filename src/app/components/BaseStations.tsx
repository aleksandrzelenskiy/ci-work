'use client';

import { useEffect, useState } from 'react';
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

export interface BaseStation {
  _id: string;
  name: string;
  coordinates: string;
}

export default function BaseStations() {
  const [baseStations, setBaseStations] = useState<BaseStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<BaseStation | null>(
    null
  );
  const [editStation, setEditStation] = useState<BaseStation | null>(null);
  const [newStation, setNewStation] = useState({ name: '', coordinates: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [openSaveDialog, setOpenSaveDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);

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
    fetchStations();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (error || success) {
      timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 4000);
    }
    return () => clearTimeout(timer);
  }, [error, success]);

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
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      const createdStation = await response.json();
      setBaseStations([...baseStations, createdStation]);
      setNewStation({ name: '', coordinates: '' });
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
        const errorData = await response.json();
        throw new Error(errorData.message);
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
      setOpenSaveDialog(false); // Закрываем диалог
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update error');
    }
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
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      setBaseStations(
        baseStations.filter((st) => st._id !== selectedStation._id)
      );
      setSelectedStation(null);
      setIsEditing(false);
      setSuccess(`Base station ${selectedStation.name} deleted successfully`);
      setOpenDeleteDialog(false); // Закрываем диалог
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
          <Typography variant='body1'>
            Coordinates: {selectedStation.coordinates}
          </Typography>
          <Button
            startIcon={<EditIcon />}
            variant='outlined'
            onClick={startEditing}
            sx={{ mt: 2 }}
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
            onChange={(e) =>
              setEditStation({ ...editStation, coordinates: e.target.value })
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

      {error && (
        <Alert variant='filled' severity='error' sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant='filled' severity='success' sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

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

        <Button type='submit' variant='contained' color='primary'>
          Add
        </Button>
      </form>
    </Box>
  );
}

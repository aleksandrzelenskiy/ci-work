'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  Fab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import TaskListPage from '../components/TaskListPage';
import TaskColumnPage from '../components/TaskColumnPage';

const TasksPage = () => {
  const [viewMode, setViewMode] = useState('table');
  const router = useRouter();

  const handleAddClick = () => {
    router.push('/orders');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant='body2'>Select Mode:</Typography>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(event, newMode) => {
            if (newMode !== null) {
              setViewMode(newMode);
            }
          }}
          size='small'
        >
          <ToggleButton value='table'>Table</ToggleButton>
          <ToggleButton value='kanban'>Kanban</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Paper
        sx={{
          width: '100%',
          boxSizing: 'border-box',
          minWidth: { xs: '100%', sm: 600 },
        }}
      >
        {viewMode === 'table' ? <TaskListPage /> : <TaskColumnPage />}
      </Paper>

      <Fab
        color='primary'
        aria-label='add'
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
        }}
        onClick={handleAddClick}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default TasksPage;

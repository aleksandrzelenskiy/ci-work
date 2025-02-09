'use client';

import { useState } from 'react';
import {
  Box,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
} from '@mui/material';
import TaskListPage from '../components/TaskListPage';
import TaskColumnPage from '../components/TaskColumnPage';

const TasksPage = () => {
  const [viewMode, setViewMode] = useState('table');

  return (
    <div>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant='body2'>SELECT MODE:</Typography>
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

      <Paper>
        {viewMode === 'table' ? <TaskListPage /> : <TaskColumnPage />}
      </Paper>
    </div>
  );
};

export default TasksPage;

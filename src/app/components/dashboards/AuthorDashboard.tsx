// app/components/dashboards/AuthorDashboard.tsx

'use client';

import React from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';

interface AuthorDashboardProps {
  role: string;
  clerkUserId: string;
}

const AuthorDashboard: React.FC<AuthorDashboardProps> = ({
  role,
  clerkUserId,
}) => {
  console.log(role, clerkUserId);

  return (
    <Box>
      <Typography variant='h6' gutterBottom>
        Author Dashboard
      </Typography>

      {/* Блок со статистикой */}

      <Grid container spacing={2}>
        {/* Last Tasks */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='subtitle1'>Last Tasks</Typography>
            {/* Список последних задач для Author */}
          </Paper>
        </Grid>
        {/* Last Reports */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='subtitle1'>Last Reports</Typography>
            {/* Список последних отчётов для Author */}
          </Paper>
        </Grid>
        {/* Task Location */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='subtitle1'>Task Location</Typography>
            {/* Блок с локацией задач */}
          </Paper>
        </Grid>
        {/* Дополнительный блок */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='subtitle1'>Some Future Block</Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AuthorDashboard;

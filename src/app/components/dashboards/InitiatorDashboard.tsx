// app/components/dashboards/InitiatorDashboard.tsx

'use client';

import React from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';

interface InitiatorDashboardProps {
  role: string;
  clerkUserId: string;
}

const InitiatorDashboard: React.FC<InitiatorDashboardProps> = ({
  role,
  clerkUserId,
}) => {
  console.log(role, clerkUserId);
  return (
    <Box>
      <Typography variant='h6' gutterBottom>
        Initiator Dashboard
      </Typography>

      {/* Блок со статистикой */}

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='subtitle1'>Last Tasks</Typography>
            {/* Список последних задач для Initiator */}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='subtitle1'>Last Reports</Typography>
            {/* Список последних отчётов для Initiator */}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='subtitle1'>Task Location</Typography>
            {/* Блок с локацией задач */}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='subtitle1'>Some Future Block</Typography>
            {/* Дополнительный блок */}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default InitiatorDashboard;

// app/components/dashboards/AdminDashboard.tsx

'use client';

import React from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';

interface AdminDashboardProps {
  role: string;
  clerkUserId: string;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  role,
  clerkUserId,
}) => {
  console.log(role, clerkUserId);

  return (
    <Box>
      <Typography variant='h6' gutterBottom>
        Admin Dashboard
      </Typography>

      <Grid container spacing={2}>
        {/* Last Tasks */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='subtitle1'>Last Tasks</Typography>
            {/* Список последних задач для Admin */}
          </Paper>
        </Grid>
        {/* Last Reports */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='subtitle1'>Last Reports</Typography>
            {/* Список последних отчётов для Admin */}
          </Paper>
        </Grid>
        {/* Task Location */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='subtitle1'>Task Location</Typography>
            {/* Инфа о локации задач */}
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

export default AdminDashboard;

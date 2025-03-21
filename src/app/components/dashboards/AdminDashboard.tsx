// app/components/dashboards/AdminDashboard.tsx

'use client';

import React from 'react';
import { Box, Grid, Paper, Typography } from '@mui/material';
import MiniMap from '@/app/components/dashboards/MiniMap';
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

        {/* Task Location (с мини-картой) */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='subtitle1'>Task Location</Typography>
            <MiniMap role={role} clerkUserId={clerkUserId} />
          </Paper>
        </Grid>

        {/* Дополнительный блок */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant='subtitle1'>Some Future Block</Typography>
            {/* Вставляйте сюда любой другой нужный функционал */}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdminDashboard;

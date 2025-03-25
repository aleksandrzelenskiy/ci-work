// app/page.tsx

import React from 'react';
import { Box, Typography } from '@mui/material';
import { GetCurrentUserFromMongoDB } from 'src/server-actions/users';
import AdminDashboard from '@/app/components/dashboards/AdminDashboard';
import ManagerDashboard from '@/app/components/dashboards/ManagerDashboard';
import AuthorDashboard from '@/app/components/dashboards/AuthorDashboard';
import InitiatorDashboard from '@/app/components/dashboards/InitiatorDashboard';
import ExecutorDashboard from '@/app/components/dashboards/ExecutorDashboard';

const DashboardPage: React.FC = async () => {
  const response = await GetCurrentUserFromMongoDB();
  if (!response || !response.success) {
    return (
      <Box className='p-4 md:p-8' sx={{ minHeight: '100vh' }}>
        <Typography variant='h4' component='h1' align='center' color='error'>
          {response?.message || 'User data not found'}
        </Typography>
      </Box>
    );
  }

  const user = response.data;
  const { name, email, clerkUserId, role } = user;

  return (
    <Box sx={{ minHeight: '100vh' }}>
      {/* Приветствие */}
      <Box className='mb-6'>
        <Typography variant='h5' component='h1' align='center'>
          Welcome, {name} ({role})!
        </Typography>
        <Typography variant='body2' component='p' align='center'>
          {email}
        </Typography>
      </Box>

      {/* Рендерим нужный Dashboard с передачей role и clerkUserId */}
      {role === 'admin' && (
        <AdminDashboard role={role} clerkUserId={clerkUserId} />
      )}
      {role === 'manager' && (
        <ManagerDashboard role={role} clerkUserId={clerkUserId} />
      )}
      {role === 'author' && (
        <AuthorDashboard role={role} clerkUserId={clerkUserId} />
      )}
      {role === 'initiator' && (
        <InitiatorDashboard role={role} clerkUserId={clerkUserId} />
      )}
      {role === 'executor' && (
        <ExecutorDashboard role={role} clerkUserId={clerkUserId} />
      )}
    </Box>
  );
};

export default DashboardPage;

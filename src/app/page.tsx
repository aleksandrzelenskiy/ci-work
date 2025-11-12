// app/page.tsx

import React from 'react';
import { Box, Typography } from '@mui/material';
import { GetUserContext } from '@/server-actions/user-context';
import AdminDashboard from '@/app/components/dashboards/AdminDashboard';
import ManagerDashboard from '@/app/components/dashboards/ManagerDashboard';
import ExecutorDashboard from '@/app/components/dashboards/ExecutorDashboard';

const DashboardPage: React.FC = async () => {
  const response = await GetUserContext();
  if (!response || !response.success) {
    return (
      <Box className='p-4 md:p-8' sx={{ minHeight: '100vh' }}>
        <Typography variant='h4' component='h1' align='center' color='error'>
          {response?.message || 'User data not found'}
        </Typography>
      </Box>
    );
  }

  const { user, activeMembership, effectiveOrgRole } = response.data;
  const { name, email, clerkUserId } = user;
  const role = effectiveOrgRole || activeMembership?.role || 'viewer';
  const adminRoles = new Set(['super_admin', 'owner', 'org_admin']);

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
      {adminRoles.has(role) && (
        <AdminDashboard role={role} clerkUserId={clerkUserId} />
      )}
      {role === 'manager' && (
        <ManagerDashboard role={role} clerkUserId={clerkUserId} />
      )}
      {role === 'executor' || role === 'viewer' ? (
        <ExecutorDashboard role={role} clerkUserId={clerkUserId} />
      ) : null}
    </Box>
  );
};

export default DashboardPage;

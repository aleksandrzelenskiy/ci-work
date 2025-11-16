// app/page.tsx

import React from 'react';
import { Box, Typography } from '@mui/material';
import { GetUserContext } from '@/server-actions/user-context';

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

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        p: 4,
      }}
    >
      <Typography variant='h5' component='h1'>
        Главная страница обновляется. Мы готовим новый интерфейс под роли
        пользователей.
      </Typography>
    </Box>
  );
};

export default DashboardPage;

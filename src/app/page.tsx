// app/page.tsx

import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';

const DashboardPage: React.FC = async () => {
  const response = await GetCurrentUserFromMongoDB();

  // Добавляем проверку на наличие данных
  if (!response || !response.data) {
    return (
      <Box className='p-4 md:p-8' sx={{ minHeight: '100vh' }}>
        <Typography variant='h4' component='h1' className='text-center'>
          Error: User data not found
        </Typography>
      </Box>
    );
  }

  const user = response.data;
  const { name, email } = user;

  console.log(`logged in user: ${name} | email: ${email}`);

  return (
    <Box className='p-4 md:p-8' sx={{ minHeight: '100vh' }}>
      <Box className='mb-6'>
        <Typography variant='h4' component='h1' className='text-center'>
          Welcome, {name}!
        </Typography>
        <Typography variant='body2' component='h1' className='text-center'>
          {email}!
        </Typography>
      </Box>
      <Box className='mb-4'>
        <Typography variant='h5' component='h2' className='text-center'>
          Your Photo Report Statistics
        </Typography>
      </Box>

      {/* Секция счетчиков */}
      <Box className='mb-8'>
        <Box className='flex flex-wrap gap-4 justify-center'>
          {/* Пример счетчика */}
          <Paper
            className='flex flex-col items-center p-4 rounded-lg shadow-md'
            sx={{ width: { xs: '100%', sm: '45%', md: '22%' } }}
          >
            <Typography variant='h6'>Pending</Typography>
            <Typography variant='h3'>10</Typography>
            <Typography variant='body2' className='text-green-500'>
              +2% from last month
            </Typography>
          </Paper>

          {/* Добавьте другие счетчики аналогично */}
          <Paper
            className='flex flex-col items-center p-4 rounded-lg shadow-md'
            sx={{ width: { xs: '100%', sm: '45%', md: '22%' } }}
          >
            <Typography variant='h6'>Issues</Typography>
            <Typography variant='h3'>5</Typography>
            <Typography variant='body2' className='text-red-500'>
              -1% from last month
            </Typography>
          </Paper>

          <Paper
            className='flex flex-col items-center p-4 rounded-lg shadow-md'
            sx={{ width: { xs: '100%', sm: '45%', md: '22%' } }}
          >
            <Typography variant='h6'>Fixed</Typography>
            <Typography variant='h3'>7</Typography>
            <Typography variant='body2' className='text-green-500'>
              +3% from last month
            </Typography>
          </Paper>

          <Paper
            className='flex flex-col items-center p-4 rounded-lg shadow-md'
            sx={{ width: { xs: '100%', sm: '45%', md: '22%' } }}
          >
            <Typography variant='h6'>Agreed</Typography>
            <Typography variant='h3'>15</Typography>
            <Typography variant='body2' className='text-green-500'>
              +4% from last month
            </Typography>
          </Paper>
        </Box>
      </Box>

      {/* Секция таблицы отчетов */}
      <Paper className=' p-4 rounded-lg shadow-md'>
        <Typography variant='h5' className='mb-4'>
          Your Submitted Photo Reports
        </Typography>
        <Box className='overflow-x-auto'>
          {/* Заглушка для таблицы */}
          <Box className='h-48 flex items-center justify-center rounded'>
            <Typography variant='body1' color='textSecondary'>
              The reports table will be displayed here
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default DashboardPage;

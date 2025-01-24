// app/page.tsx

import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';
import ReportModel from '@/models/Report';
import ReportsPage from './reports/page';

const DashboardPage: React.FC = async () => {
  // Вызов функции для получения текущего пользователя из MongoDB
  const response = await GetCurrentUserFromMongoDB();

  // Проверка успешности запроса
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

  // Выполняем агрегацию отчетов по статусам для текущего пользователя
  const reportsAggregation = await ReportModel.aggregate([
    { $match: { userId: clerkUserId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  // Инициализируем объект с нулями для каждого статуса
  const reportCounts: { [key: string]: number } = {
    Pending: 0,
    Issues: 0,
    Fixed: 0,
    Agreed: 0,
  };

  // Заполняем объект значениями из агрегации
  reportsAggregation.forEach((item) => {
    if (item._id in reportCounts) {
      reportCounts[item._id] = item.count;
    }
  });

  return (
    <Box className='p-4 md:p-8' sx={{ minHeight: '100vh' }}>
      {/* Приветствие с именем и ролью */}
      <Box className='mb-6'>
        <Typography variant='h4' component='h1' align='center'>
          Welcome, {name} ({role})!
        </Typography>
        <Typography variant='body2' component='p' align='center'>
          {email}
        </Typography>
      </Box>

      {/* Секция статистики */}
      <Box className='mb-4' sx={{ width: '100%' }}>
        <Typography variant='h5' component='h2' align='center'>
          Your Statistics
        </Typography>
      </Box>

      <Box className='mb-8' sx={{ width: '100%' }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            justifyContent: 'center',
            width: '100%',
          }}
        >
          {/* Счетчик Pending */}
          <Paper
            className='flex flex-col items-center p-4 rounded-lg shadow-md'
            sx={{
              width: { xs: '100%', sm: '45%', md: '22%' },
              boxSizing: 'border-box',
            }}
          >
            <Typography variant='h6'>Pending</Typography>
            <Typography variant='h3'>{reportCounts.Pending}</Typography>
            <Typography variant='body2' sx={{ color: 'green.500' }}>
              +2% from last month
            </Typography>
          </Paper>

          {/* Счетчик Issues */}
          <Paper
            className='flex flex-col items-center p-4 rounded-lg shadow-md'
            sx={{
              width: { xs: '100%', sm: '45%', md: '22%' },
              boxSizing: 'border-box',
            }}
          >
            <Typography variant='h6'>Issues</Typography>
            <Typography variant='h3'>{reportCounts.Issues}</Typography>
            <Typography variant='body2' sx={{ color: 'red.500' }}>
              -1% from last month
            </Typography>
          </Paper>

          {/* Счетчик Fixed */}
          <Paper
            className='flex flex-col items-center p-4 rounded-lg shadow-md'
            sx={{
              width: { xs: '100%', sm: '45%', md: '22%' },
              boxSizing: 'border-box',
            }}
          >
            <Typography variant='h6'>Fixed</Typography>
            <Typography variant='h3'>{reportCounts.Fixed}</Typography>
            <Typography variant='body2' sx={{ color: 'green.500' }}>
              +3% from last month
            </Typography>
          </Paper>

          {/* Счетчик Agreed */}
          <Paper
            className='flex flex-col items-center p-4 rounded-lg shadow-md'
            sx={{
              width: { xs: '100%', sm: '45%', md: '22%' },
              boxSizing: 'border-box',
            }}
          >
            <Typography variant='h6'>Agreed</Typography>
            <Typography variant='h3'>{reportCounts.Agreed}</Typography>
            <Typography variant='body2' sx={{ color: 'green.500' }}>
              +4% from last month
            </Typography>
          </Paper>
        </Box>
      </Box>

      {/* Секция таблицы отчетов */}
      <Box sx={{ width: '100%' }}>
        <Box className='mb-4'>
          <Typography variant='h5' component='h2' align='center'>
            Your Reports
          </Typography>
        </Box>
        <ReportsPage />
      </Box>
    </Box>
  );
};

export default DashboardPage;

// app/page.tsx

import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '../utils/mongoose';
import UserModel from '../models/UserModel';
import ReportModel from '../models/Report'; // Импорт модели отчетов
import ReportsPage from './reports/page';

const DashboardPage: React.FC = async () => {
  // Получаем данные текущего пользователя
  const loggedInUserData = await currentUser();

  // Если пользователь не авторизован
  if (!loggedInUserData) {
    return (
      <Box
        className='p-4 md:p-8'
        sx={{
          minHeight: '100vh',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Typography variant='h4' component='h1' align='center'>
          Not signed in
        </Typography>
      </Box>
    );
  }

  // Имя пользователя
  const userName = `${loggedInUserData.firstName}`;

  // Подключаемся к базе данных через mongoose
  await dbConnect();

  // Находим пользователя в базе данных
  const userRecord = await UserModel.findOne({
    clerkUserId: loggedInUserData.id,
  });

  // Если пользователь не найден в базе данных
  if (!userRecord) {
    return (
      <Box
        className='p-4 md:p-8'
        sx={{
          minHeight: '100vh',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <Typography variant='h4' component='h1' align='center'>
          User not found
        </Typography>
      </Box>
    );
  }

  // Роль пользователя
  const role = userRecord.role;

  // Выполняем агрегацию отчетов по статусам для текущего пользователя
  const reportsAggregation = await ReportModel.aggregate([
    { $match: { userId: userRecord.clerkUserId } },
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
    <Box
      className='p-4 md:p-8'
      sx={{
        minHeight: '100vh',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Приветствие с именем и ролью */}
      <Box className='mb-6'>
        <Typography variant='h4' component='h1' align='center'>
          Welcome, {userName} ({role})!
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

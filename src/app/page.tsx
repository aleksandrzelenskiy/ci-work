import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';
import ReportModel from '@/models/Report';
import ReportsPage from './reports/page';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

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

  // Условие $match в зависимости от роли
  let matchCondition: Record<string, string> = {};
  if (role === 'author') {
    matchCondition = { userId: clerkUserId };
  } else if (role === 'reviewer') {
    matchCondition = { reviewerId: clerkUserId };
  } else {
    // Например, admin => оставляем пустым, чтобы показывать все
    matchCondition = {};
  }

  // =====================
  // Текущая статистика (за всё время)
  // =====================
  const reportsAggregation = await ReportModel.aggregate([
    { $match: matchCondition },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const reportCounts: { [key: string]: number } = {
    Pending: 0,
    Issues: 0,
    Fixed: 0,
    Agreed: 0,
  };
  reportsAggregation.forEach((item) => {
    if (item._id in reportCounts) {
      reportCounts[item._id] = item.count;
    }
  });

  // =====================
  // Статистика за ПРЕДЫДУЩИЙ месяц
  // =====================
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const reportsAggregationLastMonth = await ReportModel.aggregate([
    {
      $match: {
        ...matchCondition,
        createdAt: {
          $gte: startOfLastMonth,
          $lt: startOfThisMonth,
        },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const reportCountsLastMonth: { [key: string]: number } = {
    Pending: 0,
    Issues: 0,
    Fixed: 0,
    Agreed: 0,
  };
  reportsAggregationLastMonth.forEach((item) => {
    if (item._id in reportCountsLastMonth) {
      reportCountsLastMonth[item._id] = item.count;
    }
  });

  // =====================
  // Функция вычисления разницы в %
  // =====================
  function getDifferencePercent(current: number, previous: number) {
    // (current - previous)/previous * 100
    if (previous === 0) {
      // Если раньше было 0, а сейчас > 0 — «бесконечный» рост
      if (current > 0) return 999; // можно заменить на любое число или '∞'
      // если обе величины 0 => 0
      return 0;
    }
    const diff = ((current - previous) / previous) * 100;
    return diff;
  }

  // Посчитаем для каждого статуса
  const diffPending = getDifferencePercent(
    reportCounts.Pending,
    reportCountsLastMonth.Pending
  );
  const diffIssues = getDifferencePercent(
    reportCounts.Issues,
    reportCountsLastMonth.Issues
  );
  const diffFixed = getDifferencePercent(
    reportCounts.Fixed,
    reportCountsLastMonth.Fixed
  );
  const diffAgreed = getDifferencePercent(
    reportCounts.Agreed,
    reportCountsLastMonth.Agreed
  );

  // =====================
  // Хэлпер для генерации нужного цвета/иконки
  // =====================
  function getColorAndIcon(diffValue: number) {
    if (diffValue > 0) {
      return {
        color: 'green', // зелёный текст
        Icon: <TrendingUpIcon sx={{ color: 'green' }} />,
      };
    } else if (diffValue < 0) {
      return {
        color: 'red', // красный текст
        Icon: <TrendingDownIcon sx={{ color: 'red' }} />,
      };
    }
    // diffValue === 0
    return {
      color: 'inherit',
      Icon: null,
    };
  }

  // Функция форматирования. Убираем десятичные (Math.round)
  function formatDiff(diffValue: number): string {
    const rounded = Math.round(Math.abs(diffValue));
    // + / - / (нет знака)
    const sign = diffValue > 0 ? '+' : diffValue < 0 ? '-' : '';
    return `${sign}${rounded}% from last month`;
  }

  return (
    <Box className='p-4 md:p-8' sx={{ minHeight: '100vh' }}>
      {/* Приветствие */}
      <Box className='mb-6'>
        <Typography variant='h5' component='h1' align='center'>
          Welcome, {name} ({role})!
        </Typography>
        <Typography variant='body2' component='p' align='center'>
          {email}
        </Typography>
      </Box>

      {/* Заголовок статистики */}
      <Box className='mb-4' sx={{ width: '100%' }}>
        <Typography variant='h5' component='h2' align='center'>
          Report Statistics
        </Typography>
      </Box>

      {/* Блок счётчиков */}
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
          {/* Pending */}
          <Paper
            className='flex flex-col items-center p-4 rounded-lg shadow-md'
            sx={{
              width: { xs: '100%', sm: '45%', md: '22%' },
              boxSizing: 'border-box',
            }}
          >
            {(() => {
              const { color, Icon } = getColorAndIcon(diffPending);
              return (
                <>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Typography variant='h6'>Pending</Typography>
                  </Box>
                  <Typography variant='h3'>{reportCounts.Pending}</Typography>
                  <Typography variant='body2' sx={{ color }}>
                    {Icon} {formatDiff(diffPending)}
                  </Typography>
                </>
              );
            })()}
          </Paper>

          {/* Issues */}
          <Paper
            className='flex flex-col items-center p-4 rounded-lg shadow-md'
            sx={{
              width: { xs: '100%', sm: '45%', md: '22%' },
              boxSizing: 'border-box',
            }}
          >
            {(() => {
              const { color, Icon } = getColorAndIcon(diffIssues);
              return (
                <>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Typography variant='h6'>Issues</Typography>
                  </Box>
                  <Typography variant='h3'>{reportCounts.Issues}</Typography>
                  <Typography variant='body2' sx={{ color }}>
                    {Icon} {formatDiff(diffIssues)}
                  </Typography>
                </>
              );
            })()}
          </Paper>

          {/* Fixed */}
          <Paper
            className='flex flex-col items-center p-4 rounded-lg shadow-md'
            sx={{
              width: { xs: '100%', sm: '45%', md: '22%' },
              boxSizing: 'border-box',
            }}
          >
            {(() => {
              const { color, Icon } = getColorAndIcon(diffFixed);
              return (
                <>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Typography variant='h6'>Fixed</Typography>
                  </Box>
                  <Typography variant='h3'>{reportCounts.Fixed}</Typography>
                  <Typography variant='body2' sx={{ color }}>
                    {Icon} {formatDiff(diffFixed)}
                  </Typography>
                </>
              );
            })()}
          </Paper>

          {/* Agreed */}
          <Paper
            className='flex flex-col items-center p-4 rounded-lg shadow-md'
            sx={{
              width: { xs: '100%', sm: '45%', md: '22%' },
              boxSizing: 'border-box',
            }}
          >
            {(() => {
              const { color, Icon } = getColorAndIcon(diffAgreed);
              return (
                <>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Typography variant='h6'>Agreed</Typography>
                  </Box>
                  <Typography variant='h3'>{reportCounts.Agreed}</Typography>
                  <Typography variant='body2' sx={{ color }}>
                    {Icon} {formatDiff(diffAgreed)}
                  </Typography>
                </>
              );
            })()}
          </Paper>
        </Box>
      </Box>

      {/* Блок "Your Reports" */}
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

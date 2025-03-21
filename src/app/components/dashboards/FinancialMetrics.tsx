'use client';

import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { Task } from '@/app/types/taskTypes';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function FinancialMetrics() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAllTasks() {
      try {
        const res = await fetch('/api/tasks');
        if (!res.ok) {
          throw new Error('Error fetching tasks');
        }
        const data = await res.json();
        setTasks(data.tasks);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('Unknown error');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchAllTasks();
  }, []);

  if (loading) {
    return (
      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        minHeight={100}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color='error' textAlign='center'>
        {error}
      </Typography>
    );
  }

  // Фильтруем задачи со статусом "Agreed"
  const agreedTasks = tasks.filter((t) => t.status === 'Agreed');

  // Общая сумма totalCost для задач со статусом "Agreed" – это наш total (100%)
  const totalAgreed = agreedTasks.reduce(
    (acc, t) => acc + (t.totalCost || 0),
    0
  );

  // Вычисляем метрики по логике:
  // Sum to Pay = 70% от total
  const sumToPay = totalAgreed * 0.7;
  // Commission = 10% от total (отображается серым)
  const commission = totalAgreed * 0.1;
  // Эффективный revenue = 30% от total минус commission = 20% от total
  const effectiveRevenue = totalAgreed * 0.2;
  // Разбиваем effectiveRevenue на Tax и Profit:
  // Tax = 15% от effectiveRevenue, Profit = 85% от effectiveRevenue
  const tax = effectiveRevenue * 0.15;
  const profit = effectiveRevenue * 0.85;

  // Подготавливаем данные для диаграммы
  const chartData = [
    { name: 'Sum to Pay', value: Number(sumToPay.toFixed(2)) },
    { name: 'Commission', value: Number(commission.toFixed(2)) },
    { name: 'Tax', value: Number(tax.toFixed(2)) },
    { name: 'Profit', value: Number(profit.toFixed(2)) },
  ];

  // Цвета для каждого сегмента
  const COLORS = ['#0088FE', '#B3B3B3', '#FFBB28', '#388E3C'];

  // Функция форматирования суммы с символом рубля
  const formatRuble = (value: number) => `${value.toFixed(2)} ₽`;

  return (
    <Box>
      <Typography variant='h6' gutterBottom>
        Financial Metrics
      </Typography>
      {/* <Typography variant='body1'>
        Total cost (status = &quot;Agreed&quot;): {formatRuble(totalAgreed)}
      </Typography>
      <Typography variant='body1'>
        Sum to Pay (70%): {formatRuble(sumToPay)}
      </Typography>
      <Typography variant='body1'>
        Commission (10%): {formatRuble(commission)}
      </Typography>
      <Typography variant='body1'>
        Tax (15% от effective revenue): {formatRuble(tax)}
      </Typography>
      <Typography variant='body1'>
        Profit (85% от effective revenue): {formatRuble(profit)}
      </Typography> */}

      <Box width='100%' height={400}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={chartData}
              dataKey='value'
              nameKey='name'
              cx='50%'
              cy='50%'
              outerRadius={120}
              innerRadius={60}
              label={({ value }) => formatRuble(value)}
              labelLine={false}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            {/* Текст в центре диаграммы */}
            <text
              x='50%'
              y='47.5%'
              textAnchor='middle'
              dominantBaseline='middle'
              style={{ fontSize: '18px', fontWeight: 'bold' }}
            >
              {formatRuble(totalAgreed)}
            </text>
            <Tooltip formatter={(value: number) => formatRuble(value)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}

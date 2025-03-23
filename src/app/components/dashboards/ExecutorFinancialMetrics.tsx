'use client';

import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Task } from '@/app/types/taskTypes';
import { getStatusColor } from '@/utils/statusColors';

export default function ExecutorFinancialMetrics() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Коэффициент для расчёта стоимости для исполнителя
  const executorCoefficient = 0.7;

  useEffect(() => {
    async function fetchTasks() {
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
    fetchTasks();
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

  // Определяем интересующие нас статусы
  const statuses = ['Assigned', 'At work', 'Done', 'Issues', 'Agreed'];

  // Группируем данные: для каждого статуса суммируем totalCost заказов и умножаем на коэффициент исполнителя
  const chartData = statuses.map((status) => {
    const sum = tasks
      .filter((t) => t.status === status)
      .reduce((acc, t) => acc + (t.totalCost || 0), 0);
    return {
      name: status,
      value: Number((sum * executorCoefficient).toFixed(2)),
    };
  });

  // Общая стоимость всех заказов
  const totalCost = tasks.reduce((acc, t) => acc + (t.totalCost || 0), 0);
  // Стоимость для исполнителя (70% от общей стоимости)
  const executorTotalCost = totalCost * executorCoefficient;

  // Функция форматирования суммы с символом рубля
  const formatRuble = (value: number) => `${value.toFixed(2)} ₽`;

  return (
    <Box>
      <Typography variant='subtitle1'>Financial metrics by All time</Typography>

      {/* Вывод текстовых строк с суммами для каждого статуса */}
      <Box mb={2}>
        {chartData.map((dataItem) => (
          <Typography
            key={dataItem.name}
            variant='body1'
            style={{ color: getStatusColor(dataItem.name) }}
          >
            {dataItem.name} tasks: {formatRuble(dataItem.value)}
          </Typography>
        ))}
      </Box>

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
              innerRadius={80}
              label={false}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getStatusColor(entry.name)} />
              ))}
            </Pie>
            {/* Текст в центре диаграммы для SVG */}
            <text
              x='50%'
              y='45%'
              textAnchor='middle'
              dominantBaseline='middle'
              style={{ fontSize: '18px', fontWeight: 'bold' }}
            >
              {formatRuble(executorTotalCost)}
            </text>
            <Tooltip formatter={(value: number) => formatRuble(value)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}

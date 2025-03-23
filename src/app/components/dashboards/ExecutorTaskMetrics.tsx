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

interface ChartData {
  name: string;
  count: number;
}

export default function ExecutorFinancialMetrics() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Допустимые статусы, как они записаны в базе
  const statuses = ['Assigned', 'At work', 'Done', 'Issues', 'Agreed'];

  // Группируем задачи по статусам и считаем количество для каждого
  const chartData: ChartData[] = statuses.map((status) => {
    const filteredTasks = tasks.filter((t) => t.status === status);
    return {
      name: status,
      count: filteredTasks.length,
    };
  });

  // Исключаем статусы, у которых нет задач
  const filteredChartData = chartData.filter((data) => data.count > 0);

  // Общее количество задач для всех отображаемых статусов
  const totalCount = filteredChartData.reduce(
    (acc, item) => acc + item.count,
    0
  );

  return (
    <Box>
      <Box width='100%' height={400}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={filteredChartData}
              dataKey='count'
              nameKey='name'
              cx='50%'
              cy='50%'
              outerRadius={120}
              innerRadius={60}
              label={({ payload }) => `${payload?.count}`}
              labelLine={false}
            >
              {filteredChartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getStatusColor(entry.name)} />
              ))}
            </Pie>
            {/* Отображаем общий счетчик задач крупнее по центру диаграммы */}
            <text
              x='50%'
              y='47.5%'
              textAnchor='middle'
              dominantBaseline='center'
              style={{ fontSize: '42px', fontWeight: 'bold' }}
            >
              {totalCount}
            </text>
            <Tooltip formatter={(value: number) => `${value}`} />
            <Legend
              formatter={(value, entry) => {
                const data = entry?.payload as ChartData | undefined;
                return data ? `${data.name} (${data.count})` : `${value}`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}

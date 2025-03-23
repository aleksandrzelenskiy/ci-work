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
import Link from 'next/link';
import { Task } from '@/app/types/taskTypes';
import { getStatusColor } from '@/utils/statusColors';
import { useRouter } from 'next/navigation';

interface ChartData {
  name: string;
  count: number;
}

interface TaskMetricDiagramProps {
  role: string;
  clerkUserId: string;
}

// Обновлённый тип для элемента payload легенды
interface CustomLegendPayload {
  color?: string;
  value?: string;
  type?: string;
  payload: ChartData;
}

// Интерфейс для кастомного рендера меток в сегментах
interface CustomizedLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  outerRadius: number;
  payload: ChartData;
}

export default function TaskMetricDiagram({
  role,
  clerkUserId,
}: TaskMetricDiagramProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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

  // Фильтрация задач по роли (для admin оставляем все)
  let tasksForMetrics = tasks;
  if (role === 'author') {
    tasksForMetrics = tasks.filter((t) => t.authorId === clerkUserId);
  } else if (role === 'initiator') {
    tasksForMetrics = tasks.filter((t) => t.initiatorId === clerkUserId);
  } else if (role === 'executor') {
    tasksForMetrics = tasks.filter((t) => t.executorId === clerkUserId);
  }

  // Полный список допустимых статусов
  const statuses: string[] = [
    'To do',
    'Assigned',
    'At work',
    'Done',
    'Pending',
    'Issues',
    'Fixed',
    'Agreed',
  ];

  // Группируем задачи по статусам и считаем количество для каждого
  const chartData: ChartData[] = statuses.map((status) => {
    const filteredTasks = tasksForMetrics.filter((t) => t.status === status);
    return {
      name: status,
      count: filteredTasks.length,
    };
  });

  // Данные для легенды – все статусы с count > 0
  const legendData = chartData.filter((data) => data.count > 0);
  // Данные для диаграммы – исключаем сегмент "Agreed"
  const pieChartData = chartData.filter(
    (data) => data.count > 0 && data.name !== 'Agreed'
  );

  // Общее количество задач (с учетом всех статусов)
  const totalCount = legendData.reduce((acc, item) => acc + item.count, 0);

  // При клике на сегмент переходим на /tasks с фильтром по статусу
  const handleSegmentClick = (status: string) => {
    router.push(`/tasks?status=${encodeURIComponent(status)}`);
  };

  // Кастомный рендер меток внутри сегментов (белым цветом)
  const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    outerRadius,
    payload,
  }: CustomizedLabelProps) => {
    const RADIAN = Math.PI / 180;
    // Располагаем метку примерно на середине от центра до края сегмента
    const radius = outerRadius * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill='white'
        textAnchor='middle'
        dominantBaseline='central'
      >
        {payload.count}
      </text>
    );
  };

  // Кастомный рендер легенды с общим счетчиком задач перед списком
  const renderLegend = (props: { payload?: unknown[] }) => {
    const payloadTyped = props.payload as CustomLegendPayload[] | undefined;
    return (
      <div style={{ textAlign: 'center' }}>
        <Typography variant='h6' gutterBottom>
          {`Total tasks: ${totalCount}`}
        </Typography>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {payloadTyped?.map((entry) => {
            const data = entry.payload;
            return (
              <Link
                key={data.name}
                href={`/tasks?status=${encodeURIComponent(data.name)}`}
                style={{
                  marginRight: 10,
                  color: entry.color || '#000',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {`${data.name} (${data.count})`}
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Box>
      <Typography variant='h6'>Task counts</Typography>
      <Box width='100%' height={350}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={pieChartData}
              dataKey='count'
              nameKey='name'
              cx='50%'
              cy='50%'
              outerRadius={120}
              innerRadius={0}
              label={renderCustomizedLabel}
              labelLine={false}
            >
              {pieChartData.map((entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={getStatusColor(entry.name)}
                  onClick={() => handleSegmentClick(entry.name)}
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `${value}`} />
            <Legend
              payload={legendData.map((item) => ({
                color: getStatusColor(item.name),
                value: item.name,
                payload: { ...item, strokeDasharray: '' },
              }))}
              content={renderLegend}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}

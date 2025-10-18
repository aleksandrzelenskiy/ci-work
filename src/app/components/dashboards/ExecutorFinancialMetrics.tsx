'use client';

import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import { Task } from '@/app/types/taskTypes';
import { FINANCE_CONFIG } from '@/config/finance';

export default function ExecutorFinancialMetrics() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { SUM_TO_PAY_PERCENT } = FINANCE_CONFIG;
    const router = useRouter();

    useEffect(() => {
        async function fetchTasks() {
            try {
                const res = await fetch('/api/tasks');
                if (!res.ok) throw new Error('Error fetching tasks');
                const data = await res.json();
                setTasks(data.tasks);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }
        fetchTasks();
    }, []);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={100}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Typography color="error" textAlign="center">
                {error}
            </Typography>
        );
    }

    const agreedTasks = tasks.filter((t) => t.status === 'Agreed');
    const agreedCount = agreedTasks.length;
    const totalAgreed = agreedTasks.reduce((acc, t) => acc + (t.totalCost || 0), 0);
    const sumToPay = totalAgreed * SUM_TO_PAY_PERCENT;

    const formatRuble = (value: number) =>
        `${value.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽`;

    const handleClick = () => {
        router.push('/tasks?status=Agreed');
    };

    return (
        <Box textAlign="center" sx={{ mt: 4 }}>
            {agreedCount > 0 ? (
                <>
                    <Typography
                        variant="body1"
                        color="text.primary"
                        sx={{ mb: 1, cursor: 'pointer' }}
                        onClick={handleClick}
                    >
                        {`${agreedCount} ${getTaskWord(agreedCount)} к оплате на сумму:`}
                    </Typography>

                    <Typography
                        variant="h2"
                        fontWeight={600}
                        color="primary"
                        sx={{
                            cursor: 'pointer',
                            transition: 'color 0.2s ease',
                            '&:hover': { color: 'primary.dark' },
                        }}
                        onClick={handleClick}
                    >
                        {formatRuble(sumToPay)}
                    </Typography>

                    <Typography variant="caption" color="text.secondary">
                        Отображается общая стоимость согласованных и неоплаченных задач
                    </Typography>
                </>
            ) : (
                <Typography variant="h6" color="text.secondary">
                    Нет задач к оплате
                </Typography>
            )}
        </Box>



    );
}

// Функция для корректного склонения слова "задача"
function getTaskWord(count: number): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'задача';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'задачи';
    return 'задач';
}

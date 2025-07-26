'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Box,
    Paper,
    ToggleButtonGroup,
    ToggleButton,
    Typography,
    Fab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

import TaskListPage from '../components/TaskListPage';
import TaskColumnPage from '../components/TaskColumnPage';
import TaskCalendarPage from '../components/TaskCalendarPage';   // ← NEW

type ViewMode = 'table' | 'kanban' | 'calendar';                 // ← NEW

export default function TasksPage() {
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [userRole, setUserRole] = useState<string | null>(null);
    const router = useRouter();

    /* --- узнаём роль пользователя ------------------------------------ */
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/current-user');
                const data = await res.json();
                setUserRole(data.role);
            } catch (err) {
                console.error('Error fetching user role:', err);
            }
        })();
    }, []);

    /* --- переход на страницу заказов --------------------------------- */
    const handleAddClick = () => router.push('/orders');

    return (
        <Box>
            {/* ---------------- переключатель режимов ---------------------- */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Typography variant="body2">Select Mode:</Typography>
                <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={(_, newMode) => {
                        if (newMode) setViewMode(newMode as ViewMode);
                    }}
                    size="small"
                >
                    <ToggleButton value="table">Table</ToggleButton>
                    <ToggleButton value="kanban">Kanban</ToggleButton>
                    <ToggleButton value="calendar">Calendar</ToggleButton> {/* NEW */}
                </ToggleButtonGroup>
            </Box>

            {/* ------------------- контент по режиму ----------------------- */}
            <Paper
                sx={{
                    width: '100%',
                    boxSizing: 'border-box',
                    minWidth: { xs: '100%', sm: 600 },
                }}
            >
                {viewMode === 'table'    && <TaskListPage />}
                {viewMode === 'kanban'   && <TaskColumnPage />}
                {viewMode === 'calendar' && <TaskCalendarPage />}        {/* NEW */}
            </Paper>

            {/* ------------------ кнопка «добавить» ------------------------ */}
            {userRole !== 'executor' && (
                <Fab
                    color="primary"
                    aria-label="add"
                    sx={{ position: 'fixed', bottom: 16, right: 16 }}
                    onClick={handleAddClick}
                >
                    <AddIcon />
                </Fab>
            )}
        </Box>
    );
}

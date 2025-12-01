'use client';

import { Box, Paper, Typography } from '@mui/material';
import MessengerInterface from '@/app/components/MessengerInterface';

export default function MessagerPage() {
    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', width: '100%' }}>
            <Paper
                elevation={0}
                sx={{
                    p: { xs: 2, sm: 3 },
                    borderRadius: 5,
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    background:
                        'linear-gradient(135deg, rgba(255,255,255,0.82) 0%, rgba(245,248,255,0.9) 100%)',
                    backdropFilter: 'blur(18px)',
                    boxShadow: '0 28px 70px rgba(15,23,42,0.12)',
                }}
            >
                <Typography variant='h5' fontWeight={700} gutterBottom>
                    Messager
                </Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                    Общайтесь с коллегами по организации, создавайте проектные группы и отвечайте
                    на личные сообщения без перехода между страницами.
                </Typography>
                <MessengerInterface />
            </Paper>
        </Box>
    );
}

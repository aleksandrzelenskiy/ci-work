'use client';

import { Box } from '@mui/material';
import BSMap from '@/app/components/BSMap';

export default function BsMapPage() {
    return (
        <Box sx={{ width: '100%', height: '100vh', p: 0, m: 0 }}>
            <BSMap />
        </Box>
    );
}

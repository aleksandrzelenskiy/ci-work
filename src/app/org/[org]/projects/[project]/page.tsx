// src/app/org/[org]/projects/[project]/page.tsx
import { Box, Typography } from '@mui/material';

type PageProps = {
    params: {
        org: string;
        project: string;
    };
};

export default function ProjectPage({ params }: PageProps) {
    const { org, project } = params;

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h5" gutterBottom>
                Проект: {project}
            </Typography>
            <Typography variant="body2" color="text.secondary">
                Организация: {org}
            </Typography>

        </Box>
    );
}

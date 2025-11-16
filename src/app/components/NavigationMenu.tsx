'use client';

import React from 'react';
import {
    Box,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import TaskIcon from '@mui/icons-material/Task';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import PlaceIcon from '@mui/icons-material/Place';

type NavigationMenuProps = {
    onNavigate: (path: string) => void;
};

const NAV_ITEMS: Array<{
    label: string;
    path: string;
    icon: React.ReactNode;
}> = [
    { label: 'Home', path: '/', icon: <HomeIcon sx={{ fontSize: 20 }} /> },
    {
        label: 'Task Manager',
        path: '/tasks',
        icon: <TaskIcon sx={{ fontSize: 20 }} />,
    },
    {
        label: 'Reports List',
        path: '/reports',
        icon: <PermMediaIcon sx={{ fontSize: 20 }} />,
    },
    {
        label: 'Task Locations',
        path: '/map',
        icon: <PlaceIcon sx={{ fontSize: 20 }} />,
    },
];

export default function NavigationMenu({ onNavigate }: NavigationMenuProps) {
    return (
        <Box sx={{ width: 250 }} role='presentation'>
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, mb: 2 }} />
            <List>
                {NAV_ITEMS.map((item) => (
                    <ListItemButton
                        key={item.path}
                        onClick={() => onNavigate(item.path)}
                        sx={{ paddingLeft: 5 }}
                    >
                        <ListItemIcon sx={{ minWidth: 30 }}>
                            {item.icon}
                        </ListItemIcon>
                        <ListItemText primary={item.label} />
                    </ListItemButton>
                ))}
            </List>
        </Box>
    );
}

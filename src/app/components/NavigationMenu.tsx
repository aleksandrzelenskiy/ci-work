'use client';

import React, { useEffect, useState } from 'react';
import {
    Avatar,
    Box,
    Button,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import TaskIcon from '@mui/icons-material/Task';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import PlaceIcon from '@mui/icons-material/Place';
import LogoutIcon from '@mui/icons-material/Logout';
import { useClerk, useUser } from '@clerk/nextjs';
import type { UserResource } from '@clerk/types';
import {
    fetchUserContext,
    type UserContextResponse,
} from '@/app/utils/userContext';

type NavigationMenuProps = {
    onNavigate: (path: string) => void;
};

const NAV_ITEMS: Array<{
    label: string;
    path: string;
    icon: React.ReactNode;
}> = [
    { label: 'ГЛАВНАЯ', path: '/', icon: <HomeIcon sx={{ fontSize: 20 }} /> },
    {
        label: 'МОИ ЗАДАЧИ',
        path: '/tasks',
        icon: <TaskIcon sx={{ fontSize: 20 }} />,
    },
    {
        label: 'ФОТООТЧЕТЫ',
        path: '/reports',
        icon: <PermMediaIcon sx={{ fontSize: 20 }} />,
    },
    {
        label: 'ГЕОЛОКАЦИИ',
        path: '/map',
        icon: <PlaceIcon sx={{ fontSize: 20 }} />,
    },
];

type DbUserPayload = {
    name?: string;
    fullName?: string;
    email?: string;
    profilePic?: string;
};

export default function NavigationMenu({ onNavigate }: NavigationMenuProps) {
    const { user } = useUser();
    const { signOut } = useClerk();
    const [userContext, setUserContext] = useState<UserContextResponse | null>(
        null
    );

    useEffect(() => {
        let isMounted = true;
        const loadUserContext = async () => {
            const context = await fetchUserContext();
            if (isMounted) {
                setUserContext(context);
            }
        };

        loadUserContext();
        return () => {
            isMounted = false;
        };
    }, []);

    const contextUser = userContext?.user as DbUserPayload | undefined;

    const normalizeValue = (value?: string | null) => {
        if (!value) return undefined;
        const trimmed = value.trim();
        return trimmed.length ? trimmed : undefined;
    };

    const contextName =
        normalizeValue(userContext?.name) ??
        normalizeValue(contextUser?.name) ??
        normalizeValue(contextUser?.fullName);

    const contextEmail =
        normalizeValue(userContext?.email) ??
        normalizeValue(contextUser?.email);
    const namedUser = user as (UserResource & { name?: string | null }) | null;
    const fallbackName =
        contextName ||
        namedUser?.name ||
        namedUser?.username ||
        'Пользователь';
    const userEmail =
        contextEmail || normalizeValue(user?.emailAddresses[0]?.emailAddress);
    const avatarSrc = contextUser?.profilePic || user?.imageUrl || '';

    const handleLogout = async () => {
        await signOut({ redirectUrl: '/sign-in' });
    };

    const handleProfileClick = () => {
        onNavigate('/profile');
    };

    return (
        <Box
            sx={{ width: 240, maxWidth: '100%', overflowX: 'hidden' }}
            role='presentation'
        >
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    p: 2,
                    mb: 2,
                    gap: 1,
                    textAlign: 'center',
                }}
            >
                <Avatar
                    alt={fallbackName}
                    src={avatarSrc}
                    sx={{ width: 64, height: 64, cursor: 'pointer' }}
                    onClick={handleProfileClick}
                />
                <Typography
                    fontWeight='600'
                    sx={{ cursor: 'pointer' }}
                    onClick={handleProfileClick}
                >
                    {fallbackName}
                </Typography>
                <Typography
                    fontSize='0.875rem'
                    color='text.secondary'
                    sx={{ cursor: 'pointer' }}
                    onClick={handleProfileClick}
                >
                    {userEmail}
                </Typography>
                <Button
                    size='small'
                    variant='outlined'
                    onClick={handleLogout}
                    startIcon={<LogoutIcon fontSize='inherit' />}
                    sx={{
                        textTransform: 'none',
                        mt: 1,
                        fontSize: '0.9rem',
                        lineHeight: 1,
                        padding: '2px 8px',
                        minHeight: 0,
                        width: 'auto',
                        fontWeight: 400,
                    }}
                >
                    Выйти
                </Button>
            </Box>
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

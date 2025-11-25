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
import { useTheme } from '@mui/material/styles';
import { usePathname } from 'next/navigation';
import HomeIcon from '@mui/icons-material/Home';
import TaskIcon from '@mui/icons-material/Task';
// import PermMediaIcon from '@mui/icons-material/PermMedia';
import PlaceIcon from '@mui/icons-material/Place';
import LogoutIcon from '@mui/icons-material/Logout';
import { useClerk, useUser } from '@clerk/nextjs';
import type { UserResource } from '@clerk/types';
import {
    fetchUserContext,
    type UserContextResponse,
    resolveRoleFromContext,
} from '@/app/utils/userContext';

type NavigationMenuProps = {
    onNavigateAction: (path: string) => void;
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
    // {
    //     label: 'ФОТООТЧЕТЫ',
    //     path: '/reports',
    //     icon: <PermMediaIcon sx={{ fontSize: 20 }} />,
    // },
];

type DbUserPayload = {
    name?: string;
    fullName?: string;
    email?: string;
    profilePic?: string;
};

export default function NavigationMenu({ onNavigateAction }: NavigationMenuProps) {
    const { user } = useUser();
    const { signOut } = useClerk();
    const pathname = usePathname() ?? '';
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';
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

        void loadUserContext();
        return () => {
            isMounted = false;
        };
    }, []);

    const contextUser = userContext?.user as DbUserPayload | undefined;
    const effectiveRole = resolveRoleFromContext(userContext);
    const isExecutor = effectiveRole === 'executor';
    const projectMatch = pathname.match(/^\/org\/([^/]+)\/projects\/([^/]+)/);
    const orgSlug = projectMatch?.[1];
    const projectRef = projectMatch?.[2];
    const managerGeoPath =
        orgSlug && projectRef
            ? `/org/${orgSlug}/projects/${projectRef}/tasks/locations`
            : '/tasks/locations';
    const geoPath = isExecutor ? '/tasks/locations' : managerGeoPath;
    const navItems = React.useMemo(
        () => [
            ...NAV_ITEMS,
            {
                label: 'ГЕОЛОКАЦИИ',
                path: geoPath,
                icon: <PlaceIcon sx={{ fontSize: 20 }} />,
            },
        ],
        [geoPath]
    );

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
        onNavigateAction('/profile');
    };

    const palette = {
        cardBg: isDarkMode ? 'rgba(28,28,30,0.85)' : 'rgba(255,255,255,0.7)',
        border: isDarkMode
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.05)',
        textPrimary: isDarkMode ? '#f5f5f7' : '#1d1d1f',
        textSecondary: isDarkMode ? '#a1a1a6' : '#515154',
        accent: '#0071e3',
        activeBg: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(245,245,247,0.9)',
        hoverBg: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(245,245,247,0.9)',
        icon: isDarkMode ? '#d2d2d7' : '#6e6e73',
    };

    return (
        <Box
            role='presentation'
            sx={{
                width: 260,
                maxWidth: '100%',
                padding: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                    textAlign: 'center',
                    padding: 2,
                    borderRadius: 4,
                    backgroundColor: palette.cardBg,
                    border: `1px solid ${palette.border}`,
                    boxShadow: isDarkMode
                        ? '0 6px 14px rgba(0,0,0,0.35)'
                        : '0 10px 20px rgba(15,23,42,0.07)',
                    backdropFilter: 'blur(14px)',
                }}
            >
                <Avatar
                    alt={fallbackName}
                    src={avatarSrc}
                    sx={{
                        width: 72,
                        height: 72,
                        cursor: 'pointer',
                        boxShadow: '0 12px 25px rgba(15,23,42,0.15)',
                    }}
                    onClick={handleProfileClick}
                />
                <Typography
                    fontWeight='600'
                    color={palette.textPrimary}
                    fontSize='1rem'
                    sx={{ cursor: 'pointer', letterSpacing: '0.02em' }}
                    onClick={handleProfileClick}
                >
                    {fallbackName}
                </Typography>
                <Typography
                    fontSize='0.875rem'
                    color={palette.textSecondary}
                    sx={{ cursor: 'pointer', letterSpacing: '0.01em' }}
                    onClick={handleProfileClick}
                >
                    {userEmail}
                </Typography>
                <Button
                    size='small'
                    variant='text'
                    onClick={handleLogout}
                    startIcon={<LogoutIcon fontSize='inherit' />}
                    sx={{
                        textTransform: 'none',
                        mt: 1,
                        fontSize: '0.9rem',
                        lineHeight: 1,
                        padding: '4px 12px',
                        borderRadius: 999,
                        minHeight: 0,
                        width: 'auto',
                        fontWeight: 500,
                        color: palette.accent,
                        '&:hover': {
                            backgroundColor: isDarkMode
                                ? 'rgba(0,113,227,0.15)'
                                : 'rgba(0,113,227,0.08)',
                        },
                    }}
                >
                    Выйти
                </Button>
            </Box>
            <List
                disablePadding
                sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
            >
                {navItems.map((item) => {
                    const isActive =
                        pathname === item.path ||
                        pathname.startsWith(`${item.path}/`);
                    return (
                        <ListItemButton
                            key={item.path}
                            disableRipple
                            onClick={() => onNavigateAction(item.path)}
                            sx={{
                                borderRadius: 3,
                                px: 2.5,
                                py: 1.5,
                                alignItems: 'center',
                                backgroundColor: isActive
                                    ? palette.activeBg
                                    : 'transparent',
                                boxShadow: isActive
                                    ? `inset 0 0 0 1px ${palette.border}`
                                    : 'none',
                                color: palette.textPrimary,
                                transition: 'all 0.25s ease',
                                '&:hover': {
                                    backgroundColor: palette.hoverBg,
                                    transform: 'translateX(4px)',
                                    boxShadow:
                                        isDarkMode
                                            ? '0 15px 35px rgba(0,0,0,0.55)'
                                            : '0 15px 35px rgba(15,23,42,0.12)',
                                },
                            }}
                        >
                            <ListItemIcon
                                sx={{
                                    minWidth: 'auto',
                                    mr: 2,
                                    color: isActive
                                        ? palette.textPrimary
                                        : palette.icon,
                                    transition: 'color 0.25s ease',
                                }}
                            >
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText
                                primary={item.label}
                                slotProps={{
                                    primary: {
                                        sx: {
                                            fontSize: '0.85rem',
                                            letterSpacing: '0.08em',
                                            fontWeight: isActive ? 600 : 500,
                                            color: isActive
                                                ? palette.textPrimary
                                                : palette.textSecondary,
                                        },
                                    },
                                }}
                            />
                        </ListItemButton>
                    );
                })}
            </List>
        </Box>
    );
}

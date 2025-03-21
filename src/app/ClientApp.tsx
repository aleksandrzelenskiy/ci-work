// src/app/ClientApp.tsx
'use client';

import React, {
  useState,
  useMemo,
  createContext,
  useContext,
  useEffect,
} from 'react';
import { useUser } from '@clerk/nextjs';
import {
  Box,
  CssBaseline,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Toolbar,
  AppBar,
  Typography,
  Button,
  Switch,
  ThemeProvider,
  createTheme,
  CircularProgress,
} from '@mui/material';
import { Menu } from '@mui/icons-material';
import LightModeIcon from '@mui/icons-material/LightMode';
import HomeIcon from '@mui/icons-material/Home';
import TaskIcon from '@mui/icons-material/Task';
import PlaceIcon from '@mui/icons-material/Place';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import StorageIcon from '@mui/icons-material/Storage';
import Badge from '@mui/material/Badge';
import MailIcon from '@mui/icons-material/Mail';
import { useRouter } from 'next/navigation';
import UserMenu from './components/UserMenu';

const ThemeContext = createContext({
  toggleTheme: () => {},
  mode: 'light',
});

export const useThemeContext = () => useContext(ThemeContext);

export default function ClientApp({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const response = await fetch('/api/current-user');
        const data = await response.json();
        setUserRole(data.role);
      } catch (error) {
        console.error('Error fetching user role:', error);
      }
    };

    fetchUserRole();
  }, []);

  // Инициализация темы из localStorage
  useEffect(() => {
    const storedMode = localStorage.getItem('themeMode') as
      | 'light'
      | 'dark'
      | null;
    if (storedMode) {
      setMode(storedMode);
    } else {
      // Опционально: определение системных предпочтений
      const prefersDark =
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      setMode(prefersDark ? 'dark' : 'light');
    }
  }, []);

  // Обновление localStorage при изменении режима
  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          background: {
            default: mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
          },
        },
      }),
    [mode]
  );

  const toggleTheme = () =>
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));

  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleToggleDrawer = () => {
    setOpen((prev) => !prev);
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    setOpen(false);
  };

  const DrawerList = (
    <Box sx={{ width: 250 }} role='presentation'>
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, mb: 2 }}>
        {/* <img
          src='/ci-logo.png'
          alt='CI Logo'
          style={{ width: '70%', maxWidth: '200px' }}
        /> */}
      </Box>
      <List>
        <ListItemButton
          onClick={() => handleNavigation('/')}
          sx={{ paddingLeft: 5 }}
        >
          <ListItemIcon sx={{ minWidth: 30 }}>
            <HomeIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText primary='Home' />
        </ListItemButton>
        <ListItemButton
          onClick={() => handleNavigation('/tasks')}
          sx={{ paddingLeft: 5 }}
        >
          <ListItemIcon sx={{ minWidth: 30 }}>
            <TaskIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText primary='Task Manager' />
        </ListItemButton>
        <ListItemButton
          onClick={() => handleNavigation('/reports')}
          sx={{ paddingLeft: 5 }}
        >
          <ListItemIcon sx={{ minWidth: 30 }}>
            <PermMediaIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText primary='Reports List' />
        </ListItemButton>
        <ListItemButton
          onClick={() => handleNavigation('/map')}
          sx={{ paddingLeft: 5 }}
        >
          <ListItemIcon sx={{ minWidth: 30 }}>
            <PlaceIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText primary='Task Locations' />
        </ListItemButton>

        <ListItemButton
          onClick={() => handleNavigation('/bs')}
          sx={{ paddingLeft: 5 }}
        >
          <ListItemIcon sx={{ minWidth: 30 }}>
            <StorageIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText primary='BS Catalog' />
        </ListItemButton>

        {/* <ListItemButton
          onClick={() => handleNavigation('/upload')}
          sx={{ paddingLeft: 5 }}
        >
          <ListItemIcon sx={{ minWidth: 30 }}>
            <AddPhotoAlternateIcon sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText primary='Upload Report' />
        </ListItemButton> */}

        {userRole !== 'executor' && (
          <ListItemButton
            onClick={() => handleNavigation('/orders')}
            sx={{ paddingLeft: 5 }}
          >
            <ListItemIcon sx={{ minWidth: 30 }}>
              <CloudUploadIcon sx={{ fontSize: 20 }} />
            </ListItemIcon>
            <ListItemText primary='Upload Order' />
          </ListItemButton>
        )}
      </List>
    </Box>
  );

  const currentYear = new Date().getFullYear();

  // Получаем состояние пользователя из Clerk
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    // Отображаем индикатор загрузки пока состояние аутентификации не загружено
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          width: '100vw',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeContext.Provider value={{ toggleTheme, mode }}>
      <ThemeProvider theme={theme}>
        <Box sx={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
          <CssBaseline />
          {isSignedIn ? (
            <>
              {/* AppBar */}
              <AppBar
                position='fixed'
                sx={{
                  backgroundColor: mode === 'dark' ? '#000' : '#1e1e1e',
                }}
              >
                <Toolbar>
                  <Button onClick={handleToggleDrawer} color='inherit'>
                    <Menu />
                  </Button>
                  <Box
                    sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}
                  >
                    <Badge
                      badgeContent={`Pro`}
                      color='primary'
                      anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                      }}
                    >
                      <Typography variant='h6'>CI Work</Typography>
                    </Badge>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      marginRight: '5px',
                    }}
                  >
                    <LightModeIcon
                      sx={{
                        fontSize: 18,
                        color: mode === 'light' ? 'yellow' : 'inherit',
                        marginRight: '0px',
                      }}
                    />
                    <Switch
                      checked={mode === 'dark'}
                      onChange={toggleTheme}
                      color='default'
                      size='medium'
                    />
                  </Box>
                  <Box
                    sx={{
                      marginRight: '20px',
                    }}
                  >
                    <Badge badgeContent={0} color='primary'>
                      <MailIcon />
                    </Badge>
                  </Box>

                  <UserMenu />
                </Toolbar>
              </AppBar>
              {/* Sidebar Drawer */}
              <Drawer
                open={open}
                onClose={handleToggleDrawer}
                sx={{
                  '& .MuiDrawer-paper': {
                    width: 240,
                    height: '100vh',
                    zIndex: 1200,
                  },
                }}
              >
                {DrawerList}
              </Drawer>
              {/* Основное содержимое */}
              <Box
                component='main'
                sx={{
                  flexGrow: 1,
                  bgcolor: 'background.default',
                  color: 'text.primary',
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'auto',
                }}
              >
                <Toolbar />
                <Box sx={{ flexGrow: 1 }}>{children}</Box>
                {/* Футер */}
                <Box
                  component='footer'
                  sx={{
                    p: 2,
                    textAlign: 'center',
                    borderTop: `1px solid ${theme.palette.divider}`,
                    mt: 2,
                  }}
                >
                  © CI Work {currentYear}
                </Box>
              </Box>
            </>
          ) : (
            <Box
              component='main'
              sx={{
                flexGrow: 1,
                bgcolor: 'background.default',
                color: 'text.primary',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                width: '100vw',
                padding: 0,
              }}
            >
              {children}
            </Box>
          )}
        </Box>
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}

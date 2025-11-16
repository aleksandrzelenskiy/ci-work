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
import Badge from '@mui/material/Badge'
import { useRouter, usePathname } from 'next/navigation';
import UserMenu from './components/UserMenu';
import { fetchUserContext } from '@/app/utils/userContext';
import NavigationMenu from '@/app/components/NavigationMenu';

const ThemeContext = createContext({
  toggleTheme: () => {},
  mode: 'light',
});

export const useThemeContext = () => useContext(ThemeContext);

export default function ClientApp({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [profileSetupCompleted, setProfileSetupCompleted] = useState<boolean | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const isOnboardingRoute = pathname === '/onboarding';

  useEffect(() => {
    const fetchUserRole = async () => {
      const data = await fetchUserContext();
      if (data) {
        const userPayload = (data.user ?? {}) as {
          profileSetupCompleted?: boolean;
        };
        const setupCompleted =
          typeof data.profileSetupCompleted !== 'undefined'
            ? data.profileSetupCompleted
            : userPayload.profileSetupCompleted;

        const normalizedSetupCompleted =
          typeof setupCompleted === 'boolean' ? setupCompleted : null;

        setProfileSetupCompleted(normalizedSetupCompleted);

        if (normalizedSetupCompleted === false && pathname !== '/onboarding') {
          router.replace('/onboarding');
        }
        if (normalizedSetupCompleted === true && pathname === '/onboarding') {
          router.replace('/');
        }
      } else {
        setProfileSetupCompleted(null);
      }
    };

    fetchUserRole();
  }, [router, pathname]);

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

  const backgroundGradient =
    mode === 'dark'
      ? 'linear-gradient(135deg, #0b0d11 0%, #151b24 60%, #0c1017 100%)'
      : 'linear-gradient(135deg, #f6f7fa 0%, #e8ecf4 50%, #f5f7fb 100%)';

  const [open, setOpen] = useState(false);

  const handleToggleDrawer = () => {
    setOpen((prev) => !prev);
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    setOpen(false);
  };

  const DrawerList = (
    <NavigationMenu onNavigate={handleNavigation} />
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

  const onboardingContent = (
    <Box
      component='main'
      sx={{
        flexGrow: 1,
        bgcolor: 'transparent',
        color: 'text.primary',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      {children}
    </Box>
  );

  const blockingScreen = (
    <Box
      component='main'
      sx={{
        flexGrow: 1,
        bgcolor: 'transparent',
        color: 'text.primary',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        width: '100vw',
      }}
    >
      <CircularProgress />
    </Box>
  );

  return (
    <ThemeContext.Provider value={{ toggleTheme, mode }}>
      <ThemeProvider theme={theme}>
        <Box
          sx={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            backgroundImage: backgroundGradient,
            backgroundAttachment: 'fixed',
            backgroundSize: 'cover',
          }}
        >
          <CssBaseline />
          {isSignedIn ? (
            isOnboardingRoute
              ? onboardingContent
              : profileSetupCompleted
              ? (
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
                )
              : blockingScreen
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

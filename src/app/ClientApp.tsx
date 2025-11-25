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
    ThemeProvider,
    createTheme,
    CircularProgress,
    IconButton,
} from '@mui/material';
import { Menu } from '@mui/icons-material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import Badge from '@mui/material/Badge'
import { useRouter, usePathname } from 'next/navigation';
import { fetchUserContext } from '@/app/utils/userContext';
import NavigationMenu from '@/app/components/NavigationMenu';
import NotificationBell from '@/app/components/NotificationBell';

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

  // Обновление localStorage при изменении режима + data-атрибут для глобальных стилей
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

  const isDarkMode = mode === 'dark';
  const appBarBg = isDarkMode ? 'rgba(12, 14, 20, 0.78)' : 'rgba(255,255,255,0.82)';
  const appBarBorder = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const appBarShadow = isDarkMode ? '0 18px 40px rgba(0,0,0,0.45)' : '0 20px 45px rgba(15,23,42,0.12)';
  const appBarText = isDarkMode ? '#f5f7ff' : '#080c1a';

  const [open, setOpen] = useState(false);

  const handleToggleDrawer = () => {
    setOpen((prev) => !prev);
  };

  const handleNavigation = (path: string) => {
    router.push(path);
    setOpen(false);
  };

  const DrawerList = (
    <NavigationMenu onNavigateAction={handleNavigation} />
  );

  const currentYear = new Date().getFullYear();
  const toolbarIconButtonSx = {
    borderRadius: '16px',
    border: `1px solid ${appBarBorder}`,
    backdropFilter: 'blur(6px)',
    width: 42,
    height: 42,
  } as const;

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
            position: 'relative',
            minHeight: '100vh',
            backgroundImage: backgroundGradient,
            backgroundAttachment: 'fixed',
            backgroundSize: 'cover',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: -80,
              right: -60,
              width: 240,
              height: 240,
              bgcolor: (theme) => theme.palette.primary.main,
              opacity: 0.25,
              filter: 'blur(120px)',
              zIndex: 0,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: -120,
              left: -40,
              width: 260,
              height: 260,
              bgcolor: (theme) => theme.palette.secondary.main,
              opacity: 0.18,
              filter: 'blur(130px)',
              zIndex: 0,
            }}
          />
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              minHeight: '100vh',
              flexDirection: 'column',
              backgroundColor: 'transparent',
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
                    elevation={0}
                    color='transparent'
                    sx={{
                      backgroundColor: appBarBg,
                      backdropFilter: 'blur(24px)',
                      borderBottom: `1px solid ${appBarBorder}`,
                      boxShadow: appBarShadow,
                      color: appBarText,
                    }}
                  >
                    <Toolbar>
                      <IconButton
                        onClick={handleToggleDrawer}
                        edge='start'
                        color='inherit'
                        sx={{
                          mr: 1,
                          borderRadius: '16px',
                          border: `1px solid ${appBarBorder}`,
                          backdropFilter: 'blur(6px)',
                        }}
                      >
                        <Menu />
                      </IconButton>
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
                        <IconButton
                          onClick={toggleTheme}
                          color='inherit'
                          sx={toolbarIconButtonSx}
                          aria-label='Переключить тему'
                        >
                          {mode === 'dark' ? (
                            <WbSunnyIcon fontSize='small' />
                          ) : (
                            <DarkModeIcon fontSize='small' />
                          )}
                        </IconButton>
                      </Box>
                      <Box
                        sx={{
                          marginRight: '12px',
                        }}
                      >
                        <NotificationBell buttonSx={toolbarIconButtonSx} />
                      </Box>
                    </Toolbar>
                  </AppBar>
                  {/* Sidebar Drawer */}
                  <Drawer
                    open={open}
                    onClose={handleToggleDrawer}
                    PaperProps={{
                      sx: {
                        width: 260,
                        height: '100vh',
                        backgroundColor: isDarkMode ? 'rgba(12,14,20,0.9)' : 'rgba(255,255,255,0.9)',
                        borderRight: `1px solid ${appBarBorder}`,
                        backdropFilter: 'blur(28px)',
                        boxShadow: appBarShadow,
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
                      bgcolor: 'transparent',
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
                bgcolor: 'transparent',
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
      </Box>
      </ThemeProvider>
    </ThemeContext.Provider>
  );
}

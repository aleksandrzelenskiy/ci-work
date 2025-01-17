'use client';

import React, {
  useState,
  useMemo,
  createContext,
  useContext,
  useEffect,
} from 'react';
import { ClerkProvider } from '@clerk/nextjs';
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
} from '@mui/material';
import { Menu } from '@mui/icons-material';
import LightModeIcon from '@mui/icons-material/LightMode';
import HomeIcon from '@mui/icons-material/Home';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import BallotIcon from '@mui/icons-material/Ballot';
import './globals.css';
import { useRouter } from 'next/navigation';
import UserMenu from './components/UserMenu';

const ThemeContext = createContext({
  toggleTheme: () => {},
  mode: 'light',
});

export const useThemeContext = () => useContext(ThemeContext);

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  // Initialize theme mode from localStorage
  useEffect(() => {
    const storedMode = localStorage.getItem('themeMode') as
      | 'light'
      | 'dark'
      | null;
    if (storedMode) {
      setMode(storedMode);
    } else {
      // Optional: Detect system preference
      const prefersDark =
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      setMode(prefersDark ? 'dark' : 'light');
    }
  }, []);

  // Update localStorage whenever mode changes
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
      {/* <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, mb: 2 }}>
        <img
          src='/ci-logo.png'
          alt='CI Logo'
          style={{ width: '70%', maxWidth: '200px' }}
        />
      </Box> */}
      <List>
        <ListItemButton
          onClick={() => handleNavigation('/')}
          sx={{ paddingLeft: 5 }}
        >
          <ListItemIcon sx={{ minWidth: 30 }}>
            <HomeIcon />
          </ListItemIcon>
          <ListItemText primary='Home' />
        </ListItemButton>
        <ListItemButton
          onClick={() => handleNavigation('/upload')}
          sx={{ paddingLeft: 5 }}
        >
          <ListItemIcon sx={{ minWidth: 30 }}>
            <CloudUploadIcon />
          </ListItemIcon>
          <ListItemText primary='Upload Report' />
        </ListItemButton>
        <ListItemButton
          onClick={() => handleNavigation('/reports')}
          sx={{ paddingLeft: 5 }}
        >
          <ListItemIcon sx={{ minWidth: 30 }}>
            <BallotIcon />
          </ListItemIcon>
          <ListItemText primary='Reports List' />
        </ListItemButton>
      </List>
    </Box>
  );

  const currentYear = new Date().getFullYear();

  return (
    <ClerkProvider>
      <ThemeContext.Provider value={{ toggleTheme, mode }}>
        <ThemeProvider theme={theme}>
          <html lang='en'>
            <body>
              <Box
                sx={{
                  display: 'flex',
                  height: '100vh',
                  flexDirection: 'column',
                }}
              >
                <CssBaseline />
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
                    <Typography variant='h6' sx={{ flexGrow: 1 }}>
                      CI Photo Report
                    </Typography>
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
                      {/* <ModeNightIcon
                        sx={{
                          fontSize: 18,
                          color: mode === 'dark' ? '#fff' : 'inherit',
                          marginLeft: '2px',
                        }}
                      /> */}
                    </Box>
                    <UserMenu />
                    {/* <UserButton afterSignOutUrl='/sign-in' /> */}
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
                {/* Main content area */}
                <Box
                  component='main'
                  sx={{
                    flexGrow: 1,
                    bgcolor: 'background.default',
                    color: 'text.primary',
                    p: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'auto',
                  }}
                >
                  <Toolbar />
                  <Box sx={{ flexGrow: 1 }}>{children}</Box>
                  {/* Footer */}
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
              </Box>
            </body>
          </html>
        </ThemeProvider>
      </ThemeContext.Provider>
    </ClerkProvider>
  );
}

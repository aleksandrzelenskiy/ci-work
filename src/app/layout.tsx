'use client';

import { ClerkProvider, UserButton } from '@clerk/nextjs';
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
} from '@mui/material';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu } from '@mui/icons-material';
import HomeIcon from '@mui/icons-material/Home';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import BallotIcon from '@mui/icons-material/Ballot';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false); // Состояние для управления открытием сайдбара
  const router = useRouter();

  // Функция для переключения состояния сайдбара
  const handleToggleDrawer = () => {
    setOpen((prev) => !prev); // Переключение между открытым и закрытым состоянием
  };

  // Функция для навигации по ссылкам
  const handleNavigation = (path: string) => {
    router.push(path);
    setOpen(false); // Закрытие сайдбара после перехода
  };

  const DrawerList = (
    <Box sx={{ width: 250 }} role='presentation' onClick={handleToggleDrawer}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          p: 2,
          mb: 2,
        }}
      >
        <img
          src='/ci-logo.png'
          alt='CI Logo'
          style={{ width: '70%', maxWidth: '200px' }}
        />
      </Box>
      <List>
        <ListItemButton
          onClick={() => handleNavigation('/')}
          sx={{ paddingLeft: 5 }}
        >
          <ListItemIcon sx={{ minWidth: 30 }}>
            {' '}
            {/* Уменьшаем минимальную ширину иконки */}
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

  return (
    <ClerkProvider>
      <html lang='en'>
        <body>
          <Box sx={{ display: 'flex', height: '100vh' }}>
            <CssBaseline />

            {/* AppBar */}
            <AppBar position='fixed' sx={{ backgroundColor: '#333' }}>
              <Toolbar>
                <Button onClick={handleToggleDrawer} color='inherit'>
                  <Menu />
                </Button>
                <Typography variant='h6' sx={{ flexGrow: 1 }}>
                  CI Photo Report
                </Typography>
                <Box sx={{ marginLeft: 'auto' }}>
                  <UserButton afterSignOutUrl='/sign-in' />
                </Box>
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
                  zIndex: 1200, // Сайдбар будет поверх контента
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
                p: 3,
                width: '100vw', // Контент всегда на всю ширину экрана
                marginLeft: 0, // Контент не сдвигается
                position: 'relative', // Контент остается с относительным позиционированием
              }}
            >
              <Toolbar />{' '}
              {/* Пустой тулбар, чтобы отступить контент от AppBar */}
              {children}
            </Box>
          </Box>
        </body>
      </html>
    </ClerkProvider>
  );
}

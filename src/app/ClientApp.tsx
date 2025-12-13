// src/app/ClientApp.tsx
'use client';

import React, {
  useState,
  useMemo,
  useEffect,
} from 'react';
import { useUser } from '@clerk/nextjs';
import type { ProfileType } from '@/app/models/UserModel';
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
    Menu as MuiMenu,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItem,
    ListItemText,
    Button,
} from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import Badge from '@mui/material/Badge'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useRouter, usePathname } from 'next/navigation';
import { fetchUserContext } from '@/app/utils/userContext';
import NavigationMenu from '@/app/components/NavigationMenu';
import NotificationBell from '@/app/components/NotificationBell';
import MessengerTrigger from '@/app/components/MessengerTrigger';
import dayjs from 'dayjs';

export default function ClientApp({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [profileSetupCompleted, setProfileSetupCompleted] = useState<boolean | null>(null);
  const [walletAnchor, setWalletAnchor] = useState<null | HTMLElement>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletInfo, setWalletInfo] = useState<{
      balance: number;
      bonusBalance: number;
      total: number;
      currency: string;
  } | null>(null);
  const [transactionsOpen, setTransactionsOpen] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<
      Array<{
          id: string;
          amount: number;
          type: 'credit' | 'debit';
          source: string;
          createdAt?: string | Date;
          balanceAfter?: number;
          bonusBalanceAfter?: number;
      }>
  >([]);

  const router = useRouter();
  const pathname = usePathname();
  const isOnboardingRoute = pathname === '/onboarding';

  useEffect(() => {
    const fetchUserRole = async () => {
      const data = await fetchUserContext();
      if (data) {
        const userPayload = (data.user ?? {}) as {
          profileSetupCompleted?: boolean;
          profileType?: ProfileType;
        };
        const resolvedProfileType: ProfileType | null =
          data.profileType ??
          (typeof userPayload.profileType === 'string'
            ? userPayload.profileType
            : null);
        const setupCompleted =
          typeof data.profileSetupCompleted !== 'undefined'
            ? data.profileSetupCompleted
            : userPayload.profileSetupCompleted;

        const normalizedSetupCompleted =
          typeof setupCompleted === 'boolean' ? setupCompleted : null;

        setProfileSetupCompleted(normalizedSetupCompleted);
        const onboardingCompleteRedirect =
          resolvedProfileType === 'employer' ? '/org/new' : '/';

        if (normalizedSetupCompleted === false && pathname !== '/onboarding') {
          router.replace('/onboarding');
        }
        if (normalizedSetupCompleted === true && pathname === '/onboarding') {
          router.replace(onboardingCompleteRedirect);
        }
      } else {
        setProfileSetupCompleted(null);
      }
    };

    void fetchUserRole();
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

  const formatRuble = (value: number) =>
      new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        maximumFractionDigits: 0,
      }).format(Math.max(0, Math.round(value)));

  const walletMenuOpen = Boolean(walletAnchor);

  const loadWalletInfo = async () => {
      setWalletLoading(true);
      setWalletError(null);
      const res = await fetch('/api/wallet/me', { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as
          | { balance: number; bonusBalance: number; total: number; currency?: string }
          | { error: string }
          | null;
      if (!res.ok || !data || 'error' in (data ?? {}) || !data) {
          setWalletInfo(null);
          setWalletError((data as { error?: string })?.error ?? 'Не удалось загрузить кошелёк');
          setWalletLoading(false);
          return;
      }
      setWalletInfo({
          balance: data.balance,
          bonusBalance: data.bonusBalance,
          total: data.total,
          currency: data.currency ?? 'RUB',
      });
      setWalletLoading(false);
  };

  const handleWalletClick = (event: React.MouseEvent<HTMLElement>) => {
      setWalletAnchor(event.currentTarget);
      void loadWalletInfo();
  };

  const handleWalletClose = () => {
      setWalletAnchor(null);
  };

  const handleOpenTransactions = async () => {
      setTransactionsOpen(true);
      setTransactionsLoading(true);
      setTransactionsError(null);
      const res = await fetch('/api/wallet/transactions?limit=20', { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as
          | {
              wallet?: { balance: number; bonusBalance: number; total: number; currency?: string };
              transactions?: Array<{
                  id: string;
                  amount: number;
                  type: 'credit' | 'debit';
                  source: string;
                  createdAt?: string;
                  balanceAfter?: number;
                  bonusBalanceAfter?: number;
              }>;
              error?: string;
          }
          | null;
      if (!res.ok || !data || 'error' in (data ?? {}) || !data) {
          setTransactions([]);
          setTransactionsError((data as { error?: string })?.error ?? 'Не удалось загрузить транзакции');
          setTransactionsLoading(false);
          return;
      }

      setTransactions(data.transactions ?? []);
      if (data.wallet) {
          setWalletInfo({
              balance: data.wallet.balance ?? 0,
              bonusBalance: data.wallet.bonusBalance ?? 0,
              total: data.wallet.total ?? 0,
              currency: data.wallet.currency ?? 'RUB',
          });
      }
      setTransactionsLoading(false);
  };

  const handleCloseTransactions = () => {
      setTransactionsOpen(false);
  };

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
                      <MenuIcon />
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <MessengerTrigger buttonSx={toolbarIconButtonSx} />
                      <IconButton
                        color='inherit'
                        sx={toolbarIconButtonSx}
                        aria-label='Кошелёк'
                        onClick={handleWalletClick}
                      >
                        <AccountBalanceWalletIcon fontSize='small' />
                      </IconButton>
                      <NotificationBell buttonSx={toolbarIconButtonSx} />
                    </Box>
                  </Toolbar>
                </AppBar>
                <MuiMenu
                  anchorEl={walletAnchor}
                  open={walletMenuOpen}
                  onClose={handleWalletClose}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                  transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  PaperProps={{
                    sx: {
                      minWidth: 260,
                      p: 1.5,
                      border: `1px solid ${appBarBorder}`,
                      boxShadow: appBarShadow,
                      borderRadius: 2.5,
                      backdropFilter: 'blur(18px)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant='subtitle2' sx={{ letterSpacing: '0.02em' }}>
                      Кошелёк
                    </Typography>
                    {walletLoading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={18} />
                        <Typography variant='body2'>Загрузка…</Typography>
                      </Box>
                    ) : walletError ? (
                      <Typography variant='body2' color='error'>
                        {walletError}
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography variant='h6' sx={{ lineHeight: 1.1 }}>
                          {formatRuble(walletInfo?.total ?? 0)}
                        </Typography>
                        <Typography variant='body2' color='text.secondary'>
                          Бонусы: {formatRuble(walletInfo?.bonusBalance ?? 0)}
                        </Typography>
                      </Box>
                    )}
                    <Divider />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant='contained'
                        size='small'
                        onClick={() => {
                          handleWalletClose();
                          void handleOpenTransactions();
                        }}
                      >
                        Транзакции
                      </Button>
                      <Button
                        variant='outlined'
                        size='small'
                        onClick={() =>
                          setWalletError((prev) => prev ?? 'Пополнение скоро будет доступно')
                        }
                      >
                        Пополнить
                      </Button>
                    </Box>
                  </Box>
                </MuiMenu>
                <Dialog
                  open={transactionsOpen}
                  onClose={handleCloseTransactions}
                  fullWidth
                  maxWidth='sm'
                >
                  <DialogTitle>Транзакции кошелька</DialogTitle>
                  <DialogContent dividers>
                    {transactionsLoading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                        <CircularProgress size={18} />
                        <Typography variant='body2'>Загрузка…</Typography>
                      </Box>
                    ) : transactionsError ? (
                      <Typography color='error'>{transactionsError}</Typography>
                    ) : transactions.length === 0 ? (
                      <Typography variant='body2'>Нет транзакций.</Typography>
                    ) : (
                      <List>
                        {transactions.map((tx) => {
                          const amountLabel =
                            (tx.type === 'credit' ? '+ ' : '- ') + formatRuble(tx.amount ?? 0);
                          const ts =
                            tx.createdAt && dayjs(tx.createdAt).isValid()
                              ? dayjs(tx.createdAt).format('DD.MM.YYYY HH:mm')
                              : '';
                          return (
                            <ListItem
                              key={tx.id}
                              divider
                              sx={{ alignItems: 'flex-start', gap: 1 }}
                            >
                              <ListItemText
                                primary={
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      gap: 1,
                                      alignItems: 'center',
                                    }}
                                  >
                                    <Typography
                                      variant='body1'
                                      color={tx.type === 'credit' ? 'success.main' : 'error.main'}
                                    >
                                      {amountLabel}
                                    </Typography>
                                    <Typography variant='caption' color='text.secondary'>
                                      {ts}
                                    </Typography>
                                  </Box>
                                }
                                secondary={
                                  <Typography variant='body2' color='text.secondary'>
                                    {tx.source}
                                  </Typography>
                                }
                              />
                            </ListItem>
                          );
                        })}
                      </List>
                    )}
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={handleCloseTransactions}>Закрыть</Button>
                  </DialogActions>
                </Dialog>
                {/* Sidebar Drawer */}
                <Drawer
                  open={open}
                  onClose={handleToggleDrawer}
                  slotProps={{
                    paper: {
                      sx: {
                        width: 260,
                        height: '100vh',
                        backgroundColor: isDarkMode ? 'rgba(12,14,20,0.9)' : 'rgba(255,255,255,0.9)',
                        borderRight: `1px solid ${appBarBorder}`,
                        backdropFilter: 'blur(28px)',
                        boxShadow: appBarShadow,
                      },
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
  );
}

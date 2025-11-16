'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Container,
} from '@mui/material';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import EngineeringIcon from '@mui/icons-material/Engineering';
import RoleCard from '@/app/components/onboarding/RoleCard';
import type { ProfileType } from '@/app/models/UserModel';

type ProfileResponse = {
  profileType?: ProfileType;
  profileSetupCompleted?: boolean;
  name?: string;
  user?: { name?: string };
  error?: string;
};

const ROLE_OPTIONS: Array<{
  type: ProfileType;
  title: string;
  description: string;
  helperText?: string;
  icon: ReactNode;
}> = [
  {
    type: 'client',
    title: 'Я заказчик',
    description:
      'Создаю задачи и управляю исполнителями внутри собственной организации.',
    helperText:
      '* Можно приглашать коллег, создавать проекты и управлять воронкой задач.',
    icon: (
      <BusinessCenterIcon
        color='primary'
        sx={{ fontSize: 50 }}
      />
    ),
  },
  {
    type: 'contractor',
    title: 'Я исполнитель',
    description:
      'Работаю по приглашению или как независимый подрядчик, мне нужен быстрый доступ к задачам.',
    helperText:
      '* Базовые функции бесплатны. Расширенный функционал по подписке.',
    icon: (
      <EngineeringIcon
        color='primary'
        sx={{ fontSize: 50 }}
      />
    ),
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<ProfileType | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/current-user', { cache: 'no-store' });
        const data: ProfileResponse = await res.json();
        if (!mounted) return;
        if (!res.ok) {
          setError(data.error || 'Не удалось загрузить профиль');
          setProfile(null);
        } else {
          const resolvedName = data.name || data.user?.name || '';
          setProfile({ ...data, name: resolvedName });
          if (data.profileSetupCompleted) {
            router.replace('/');
            return;
          }
        }
      } catch (err) {
        if (!mounted) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Не удалось загрузить профиль пользователя'
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchProfile();
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleSelect = async (profileType: ProfileType) => {
    setSavingType(profileType);
    setError(null);
    try {
      const res = await fetch('/api/current-user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileType }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Не удалось сохранить выбор');
      }

      router.replace('/');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Ошибка при сохранении выбора'
      );
    } finally {
      setSavingType(null);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 520, mx: 'auto', mt: 8 }}>
        <Alert severity='error'>{error}</Alert>
      </Box>
    );
  }

  return (
    <Container
      maxWidth='md'
      sx={{
        py: 6,
        minHeight: 'calc(100vh - 48px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant='h4' fontWeight={700} gutterBottom>
          Добро пожаловать{profile?.name ? `, ${profile.name}!` : '!'}
        </Typography>
        <Typography  variant='h6' color='text.secondary'>
          Выберите один тип профиля: ЗАКАЗЧИК или ИСПОЛНИТЕЛЬ.
        </Typography>
        <Typography color='text.secondary'>
          Для каждой роли действует собственный сценарий работы.
        </Typography>
      </Box>

      <Grid container spacing={3} justifyContent='center'>
        {ROLE_OPTIONS.map((option) => (
          <Grid item xs={12} sm={6} md={5} key={option.type} display='flex'>
            <RoleCard
              title={option.title}
              description={option.description}
              helperText={option.helperText}
              onSelect={() => handleSelect(option.type)}
              disabled={Boolean(savingType)}
              selected={profile?.profileType === option.type}
              icon={option.icon}
              actionLabel={
                savingType === option.type ? 'Сохраняем...' : 'Выбрать'
              }
            />
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Alert severity='info'>
          Исполнители получают бесплатный доступ к базовым функциям. Заказчик может назначить исполнителя менеджером проекта.
        </Alert>
      </Box>
    </Container>
  );
}

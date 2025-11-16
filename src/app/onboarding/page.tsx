'use client';

import { useEffect, useState, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  Alert,
  Container,
  TextField,
  Paper,
  Stack,
  Chip,
  Button,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import EngineeringIcon from '@mui/icons-material/Engineering';
import RoleCard from '@/app/components/onboarding/RoleCard';
import type { ProfileType } from '@/app/models/UserModel';
import {
  RUSSIAN_REGIONS,
  type RegionOption,
} from '@/app/utils/regions';

type ProfileResponse = {
  profileType?: ProfileType;
  profileSetupCompleted?: boolean;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  regionCode?: string;
  user?: {
    name?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    regionCode?: string;
  };
  error?: string;
};

type ProfileFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  regionCode: string;
};

const ROLE_OPTIONS: Array<{
  type: ProfileType;
  title: string;
  description: string;
  helperText?: string;
  icon: ReactNode;
}> = [
  {
    type: 'employer',
    title: 'ЗАКАЗЧИК',
    description:
      'Создаю задачи и управляю исполнителями внутри собственной организации.',
    helperText:
      '* Можно приглашать коллег, создавать проекты и управлять воронкой задач.',
    icon: (
      <BusinessCenterIcon
        color='inherit'
        sx={{ fontSize: 44 }}
      />
    ),
  },
  {
    type: 'contractor',
    title: 'ИСПОЛНИТЕЛЬ',
    description:
      'Работаю по приглашению или как независимый подрядчик, мне нужен быстрый доступ к задачам.',
    helperText:
      '* Базовые функции бесплатны. Расширенный функционал по подписке.',
    icon: (
      <EngineeringIcon
        color='inherit'
        sx={{ fontSize: 44 }}
      />
    ),
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<ProfileType | null>(null);
  const [selectedType, setSelectedType] = useState<ProfileType | null>(null);
  const [roleStepVisible, setRoleStepVisible] = useState(false);
  const roleSectionRef = useRef<HTMLDivElement | null>(null);
  const [formValues, setFormValues] = useState<ProfileFormValues>({
    firstName: '',
    lastName: '',
    phone: '',
    regionCode: '',
  });

  useEffect(() => {
    if (roleStepVisible && roleSectionRef.current) {
      roleSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [roleStepVisible]);

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/current-user', { cache: 'no-store' });
        const data: ProfileResponse = await res.json();
        if (!mounted) return;
        if (!res.ok) {
          setError(data.error || 'Не удалось загрузить профиль');
        } else {
          const userPayload = data.user || {};
          const resolvedFirstName =
            data.firstName ||
            (userPayload as { firstName?: string } | undefined)?.firstName ||
            '';
          const resolvedLastName =
            data.lastName ||
            (userPayload as { lastName?: string } | undefined)?.lastName ||
            '';
          const resolvedPhone =
            data.phone ||
            (userPayload as { phone?: string } | undefined)?.phone ||
            '';
          const resolvedRegionCode =
            data.regionCode ||
            (userPayload as { regionCode?: string } | undefined)?.regionCode ||
            '';
          setFormValues({
            firstName: resolvedFirstName.trim(),
            lastName: resolvedLastName.trim(),
            phone: resolvedPhone,
            regionCode: resolvedRegionCode,
          });
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

  const getTrimmedFormValues = () => {
    const trimmed = {
      firstName: formValues.firstName.trim(),
      lastName: formValues.lastName.trim(),
      phone: formValues.phone.trim(),
      regionCode: formValues.regionCode.trim(),
    };

    if (
      !trimmed.firstName ||
      !trimmed.lastName ||
      !trimmed.phone ||
      !trimmed.regionCode
    ) {
      setError('Пожалуйста, заполните личные данные и выберите регион.');
      return null;
    }

    return trimmed;
  };

  const handleContinue = () => {
    const trimmed = getTrimmedFormValues();
    if (!trimmed) {
      return;
    }
    setError(null);
    setRoleStepVisible(true);
  };

  const handleSelect = async (profileType: ProfileType) => {
    const trimmedValues = getTrimmedFormValues();
    if (!trimmedValues) {
      return;
    }

    setSelectedType(profileType);
    setSavingType(profileType);
    setError(null);
    try {
      const res = await fetch('/api/current-user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileType,
          ...trimmedValues,
        }),
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

  const isFormValid =
    Boolean(formValues.firstName.trim()) &&
    Boolean(formValues.lastName.trim()) &&
    Boolean(formValues.phone.trim()) &&
    Boolean(formValues.regionCode.trim());

  const currentRegion: RegionOption | null =
    RUSSIAN_REGIONS.find((region) => region.code === formValues.regionCode) ??
    null;

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
    <Box
      sx={{
        minHeight: '100vh',
        background: (theme) =>
          theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, #0b0d11 0%, #151b24 60%, #0c1017 100%)'
            : 'linear-gradient(135deg, #f6f7fa 0%, #e8ecf4 50%, #f5f7fb 100%)',
        py: { xs: 6, md: 10 },
      }}
    >
      <Container maxWidth='lg' sx={{ position: 'relative' }}>
        <Box
          sx={{
            position: 'absolute',
            top: -80,
            right: -60,
            width: 240,
            height: 240,
            bgcolor: 'primary.main',
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
            bgcolor: 'secondary.main',
            opacity: 0.18,
            filter: 'blur(130px)',
            zIndex: 0,
          }}
        />

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Stack spacing={2} textAlign='center' alignItems='center'>
            <Chip
              label='Шаг 1 из 2'
              color='default'
              sx={{
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            />
            <Typography variant='h3' fontWeight={700}>
              Настройте ваш профиль
            </Typography>
            <Typography variant='h6' color='text.secondary' maxWidth={620}>
              Заполните форму ниже и выберите роль. Эти данные помогут правильно
              подготовить для вас рабочее пространство.
            </Typography>
          </Stack>

          <Stack spacing={4} sx={{ mt: { xs: 5, md: 7 } }}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 3, md: 4 },
                borderRadius: 4,
                border: '1px solid',
                borderColor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(15,23,42,0.08)',
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(13,16,23,0.85)'
                    : 'rgba(255,255,255,0.9)',
                backdropFilter: 'blur(18px)',
              }}
            >
              <Stack spacing={3}>
                <Box>
                  <Typography variant='h6' fontWeight={700}>
                    Контактные данные
                  </Typography>
                  <Typography color='text.secondary'>
                    Эти данные будут видны только вашей команде.
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label='Имя'
                      fullWidth
                      value={formValues.firstName}
                      onChange={(event) =>
                        setFormValues((prev) => ({
                          ...prev,
                          firstName: event.target.value,
                        }))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label='Фамилия'
                      fullWidth
                      value={formValues.lastName}
                      onChange={(event) =>
                        setFormValues((prev) => ({
                          ...prev,
                          lastName: event.target.value,
                        }))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label='Телефон'
                      fullWidth
                      type='tel'
                      value={formValues.phone}
                      onChange={(event) =>
                        setFormValues((prev) => ({
                          ...prev,
                          phone: event.target.value,
                        }))
                      }
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Autocomplete
                      value={currentRegion}
                      options={RUSSIAN_REGIONS as RegionOption[]}
                      onChange={(_, newValue) =>
                        setFormValues((prev) => ({
                          ...prev,
                          regionCode: newValue?.code ?? '',
                        }))
                      }
                      getOptionLabel={(option) =>
                        typeof option === 'string'
                          ? option
                          : `${option.code} - ${option.label}`
                      }
                      renderInput={(params) => (
                        <TextField {...params} label='Регион' />
                      )}
                    />
                  </Grid>
                </Grid>
                <Typography variant='body2' color='text.secondary'>
                  Мы никому не передаём контакты без вашего согласия и
                  используем их только для уведомлений.
                </Typography>
                {isFormValid && (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <Button
                      variant='contained'
                      size='large'
                      onClick={handleContinue}
                    >
                      Далее
                    </Button>
                  </Box>
                )}
              </Stack>
            </Paper>

            {roleStepVisible && (
              <Stack spacing={3} textAlign='center' ref={roleSectionRef}>
                <Chip
                  label='Шаг 2 из 2'
                  color='default'
                  sx={{
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                    alignSelf: 'center',
                  }}
                />
                <Box>
                  <Typography variant='h6' fontWeight={700}>
                    Роль в платформе
                  </Typography>
                  <Typography color='text.secondary'>
                    Выберите сценарий, чтобы мы подготовили нужные панели и
                    доступы.
                  </Typography>
                </Box>
                <Grid
                  container
                  spacing={2}
                  justifyContent='center'
                  alignItems='stretch'
                >
                  {ROLE_OPTIONS.map((option) => (
                    <Grid
                      item
                      xs={12}
                      sm={6}
                      key={option.type}
                      display='flex'
                      justifyContent='center'
                    >
                      <RoleCard
                        title={option.title}
                        description={option.description}
                        helperText={option.helperText}
                        onSelect={() => handleSelect(option.type)}
                        disabled={!isFormValid || Boolean(savingType)}
                        selected={selectedType === option.type}
                        icon={option.icon}
                        actionLabel={
                          savingType === option.type
                            ? 'Сохраняем...'
                            : 'Выбрать'
                        }
                      />
                    </Grid>
                  ))}
                </Grid>
                <Typography variant='body2' color='text.secondary'>
                  Исполнители работают с задачами напрямую, а заказчики
                  управляют командами и бюджетами.
                </Typography>
              </Stack>
            )}
          </Stack>

          <Paper
            variant='outlined'
            sx={{
              mt: 5,
              borderRadius: 3,
              p: { xs: 2.5, md: 3 },
              textAlign: 'center',
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(15, 20, 30, 0.6)'
                  : 'rgba(255,255,255,0.85)',
              borderColor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(15,23,42,0.08)',
            }}
          >
            <Typography variant='body2' color='text.secondary'>
              Все настройки можно обновить позже в профиле. После заполнения мы
              мгновенно перенаправим вас в рабочее пространство.
            </Typography>
          </Paper>
        </Box>
      </Container>
    </Box>
  );
}

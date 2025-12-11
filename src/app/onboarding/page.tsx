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
import type { Theme } from '@mui/material/styles';

type ProfileResponse = {
  profileType?: ProfileType;
  profileSetupCompleted?: boolean;
  name?: string;
  phone?: string;
  regionCode?: string;
  user?: {
    name?: string;
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
    icon: <BusinessCenterIcon color='inherit' sx={{ fontSize: 44 }} />,
  },
  {
    type: 'contractor',
    title: 'ИСПОЛНИТЕЛЬ',
    description:
        'Работаю по приглашению или как независимый подрядчик, мне нужен быстрый доступ к задачам.',
    helperText:
        '* Базовые функции бесплатны. Расширенный функционал по подписке.',
    icon: <EngineeringIcon color='inherit' sx={{ fontSize: 44 }} />,
  },
];

const parseNameParts = (rawName?: string) => {
  if (!rawName) {
    return { firstName: '', lastName: '' };
  }
  const trimmed = rawName.trim();
  if (!trimmed || trimmed.includes('@')) {
    return { firstName: '', lastName: '' };
  }
  const parts = trimmed.split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ');
  return { firstName, lastName };
};

const normalizePhoneInput = (input: string) => {
  const digitsOnly = input.replace(/\D/g, '');
  if (!digitsOnly) {
    return '';
  }

  let normalized = digitsOnly;
  if (normalized.startsWith('8')) {
    normalized = `7${normalized.slice(1)}`;
  } else if (normalized.startsWith('9')) {
    normalized = `7${normalized}`;
  } else if (!normalized.startsWith('7')) {
    normalized = `7${normalized}`;
  }

  normalized = normalized.slice(0, 11);
  return `+${normalized}`;
};

const isPhoneValid = (value: string) => /^\+7\d{10}$/.test(value);

// ----- layout constants -----
const LAYOUT_MAX_WIDTH = 1080;
const FIELD_MAX_WIDTH = 520;

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
      roleSectionRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
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
          const resolvedProfileType: ProfileType | null =
              data.profileType ??
              ((userPayload as { profileType?: ProfileType }).profileType ?? null);
          const onboardingCompleteRedirect =
              resolvedProfileType === 'employer' ? '/org/new' : '/';
          const resolvedName = data.name || userPayload?.name || '';
          const { firstName: derivedFirst, lastName: derivedLast } =
              parseNameParts(resolvedName);
          const resolvedPhone =
              data.phone ||
              (userPayload as { phone?: string } | undefined)?.phone ||
              '';
          const resolvedRegionCode =
              data.regionCode ||
              (userPayload as { regionCode?: string } | undefined)?.regionCode ||
              '';
          setFormValues({
            firstName: derivedFirst,
            lastName: derivedLast,
            phone: normalizePhoneInput(resolvedPhone),
            regionCode: resolvedRegionCode,
          });
          if (data.profileSetupCompleted) {
            router.replace(onboardingCompleteRedirect);
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

    if (!isPhoneValid(trimmed.phone)) {
      setError('Введите номер телефона в формате +7XXXXXXXXXX.');
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
        setError(data?.error || 'Не удалось сохранить выбор');
        return;
      }

      const onboardingCompleteRedirect =
          profileType === 'employer' ? '/org/new' : '/';

      router.replace(onboardingCompleteRedirect);
    } catch (err) {
      setError(
          err instanceof Error ? err.message : 'Ошибка при сохранении выбора'
      );
    } finally {
      setSavingType(null);
    }
  };

  // ---- layout helpers ----
  const formSectionSx = {
    width: '100%',
    maxWidth: LAYOUT_MAX_WIDTH,
    mx: 'auto',
    px: { xs: 1.5, sm: 3, md: 2 },
  };

  const fieldSx = {
    width: '100%',
    maxWidth: FIELD_MAX_WIDTH,
    backgroundColor: (theme: Theme) =>
        theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.02)'
            : 'rgba(255,255,255,0.96)',
  };

  const formItemWrapperSx = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  };

  const centeredTextBlockSx = {
    ...formSectionSx,
    maxWidth: 720,
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0.5,
  };

  const gridSectionSx = {
    ...formSectionSx,
    justifyContent: 'center',
  };

  const actionRowSx = {
    ...formSectionSx,
    display: 'flex',
    justifyContent: 'center',
    maxWidth: FIELD_MAX_WIDTH,
  };

  const roleCardWrapperSx = {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
    maxWidth: FIELD_MAX_WIDTH,
    height: '100%',
  };

  const phoneDigits = formValues.phone.replace(/\D/g, '');
  const phoneHasValue = Boolean(formValues.phone.trim());
  const showPhoneLengthError =
      Boolean(phoneDigits) && phoneDigits.length > 0 && phoneDigits.length < 11;
  const phoneFormatInvalid = phoneHasValue && !isPhoneValid(formValues.phone);
  const phoneHelperText = showPhoneLengthError
      ? 'Номер должен содержать 11 цифр'
      : undefined;

  const isFormValid =
      Boolean(formValues.firstName.trim()) &&
      Boolean(formValues.lastName.trim()) &&
      Boolean(formValues.regionCode.trim()) &&
      isPhoneValid(formValues.phone);

  const currentRegion: RegionOption | null =
      RUSSIAN_REGIONS.find((region) => region.code === formValues.regionCode) ??
      null;

  if (loading) {
    return (
        <Box
            sx={{
              minHeight: '100vh',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
        >
          <CircularProgress />
        </Box>
    );
  }

  if (error) {
    return (
        <Box sx={{ maxWidth: FIELD_MAX_WIDTH, mx: 'auto', mt: 8, px: 2 }}>
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
            pt: { xs: 3, md: 5 },
            pb: { xs: 6, md: 10 },
          }}
      >
        <Container maxWidth='lg' sx={{ position: 'relative' }}>
          {/* мягкие свечения */}
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
              <Typography
                  variant='h3'
                  fontWeight={700}
                  sx={{
                    fontSize: { xs: '1.75rem', md: '2.75rem' },
                    lineHeight: { xs: 1.25, md: 1.3 },
                  }}
              >
                Настройте ваш профиль
              </Typography>
            </Stack>

            <Stack spacing={{ xs: 3, md: 4 }} sx={{ mt: { xs: 3, md: 4 } }}>
              {/* Блок контактов */}
              <Paper
                  elevation={0}
                  sx={{
                    width: '100%',
                    maxWidth: LAYOUT_MAX_WIDTH,
                    mx: 'auto',
                    p: { xs: 2.5, sm: 3, md: 4 },
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
                  <Box sx={centeredTextBlockSx}>
                    <Typography variant='h6' fontWeight={700} textAlign='center'>
                      Контактные данные
                    </Typography>
                    <Typography color='text.secondary' sx={{ mt: 0.5 }}>
                      Эти данные будут видны только вашей команде.
                    </Typography>
                  </Box>

                  <Grid
                      container
                      spacing={{ xs: 2, sm: 2.5, md: 3 }}
                      alignItems='stretch'
                      justifyContent='center'
                      sx={gridSectionSx}
                  >
                    <Grid item xs={12} sm={6} sx={formItemWrapperSx}>
                      <TextField
                          label='Имя'
                          fullWidth
                          sx={fieldSx}
                          value={formValues.firstName}
                          onChange={(event) =>
                              setFormValues((prev) => ({
                                ...prev,
                                firstName: event.target.value,
                              }))
                          }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} sx={formItemWrapperSx}>
                      <TextField
                          label='Фамилия'
                          fullWidth
                          sx={fieldSx}
                          value={formValues.lastName}
                          onChange={(event) =>
                              setFormValues((prev) => ({
                                ...prev,
                                lastName: event.target.value,
                              }))
                          }
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} sx={formItemWrapperSx}>
                      <TextField
                          label='Телефон'
                          fullWidth
                          sx={fieldSx}
                          type='tel'
                          value={formValues.phone}
                          onChange={(event) =>
                              setFormValues((prev) => ({
                                ...prev,
                                phone: normalizePhoneInput(event.target.value),
                              }))
                          }
                          error={Boolean(showPhoneLengthError) || phoneFormatInvalid}
                          helperText={phoneHelperText}
                          placeholder='+7XXXXXXXXXX'
                          inputProps={{ inputMode: 'tel' }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} sx={formItemWrapperSx}>
                      <Autocomplete<RegionOption, false, false, false>
                          value={currentRegion}
                          options={RUSSIAN_REGIONS as RegionOption[]}
                          fullWidth
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
                              <TextField
                                  {...params}
                                  label='Регион'
                                  fullWidth
                                  sx={fieldSx}
                              />
                          )}
                      />
                    </Grid>
                  </Grid>

                  <Typography
                      variant='body2'
                      color='text.secondary'
                      sx={centeredTextBlockSx}
                  >
                    Мы никому не передаём контакты без вашего согласия и
                    используем их только для уведомлений.
                  </Typography>

                  {/* Кнопка "Далее" всегда на месте, только блокируется */}
                  <Box sx={actionRowSx}>
                    <Button
                        variant='contained'
                        size='large'
                        onClick={handleContinue}
                        disabled={!isFormValid}
                        sx={{ minWidth: 180 }}
                    >
                      Далее
                    </Button>
                  </Box>
                </Stack>
              </Paper>

              {/* Шаг выбора роли */}
              {roleStepVisible && (
                  <Stack
                      spacing={3}
                      textAlign='center'
                      ref={roleSectionRef}
                      sx={{
                        alignItems: 'center',
                        width: '100%',
                        maxWidth: LAYOUT_MAX_WIDTH,
                        mx: 'auto',
                        mt: { xs: 1, md: 0 },
                        px: { xs: 1.5, sm: 3, md: 2 },
                      }}
                  >
                    <Chip
                        label='Шаг 2 из 2'
                        color='default'
                        sx={{
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: 1,
                        }}
                    />
                    <Box sx={centeredTextBlockSx}>
                      <Typography color='text.secondary'>
                        Выберите сценарий, чтобы мы подготовили нужные панели и
                        доступы.
                      </Typography>
                    </Box>
                    <Grid
                        container
                        spacing={{ xs: 2, sm: 2.5, md: 3 }}
                        justifyContent='center'
                        alignItems='stretch'
                        sx={gridSectionSx}
                    >
                      {ROLE_OPTIONS.map((option) => (
                          <Grid
                              item
                              xs={12}
                              sm={6}
                              md={6}
                              key={option.type}
                              sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                width: '100%',
                              }}
                          >
                            <Box sx={roleCardWrapperSx}>
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
                            </Box>
                          </Grid>
                      ))}
                    </Grid>
                    <Typography
                        variant='body2'
                        color='text.secondary'
                        sx={centeredTextBlockSx}
                    >
                      Исполнители работают с задачами напрямую, а заказчики
                      управляют командами и бюджетами.
                    </Typography>
                  </Stack>
              )}
            </Stack>

            {/* Футер-пояснение */}
            <Paper
                variant='outlined'
                sx={{
                  width: '100%',
                  maxWidth: LAYOUT_MAX_WIDTH,
                  mx: 'auto',
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

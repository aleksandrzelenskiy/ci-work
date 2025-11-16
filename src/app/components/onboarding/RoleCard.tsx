'use client';

import { Card, CardContent, CardActions, Typography, Button, Box } from '@mui/material';
import { styled } from '@mui/material/styles';

const HoverCard = styled(Card)(({ theme }) => ({
  borderWidth: 1,
  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
  '&:hover': {
    transform: 'translateY(-4px) scale(1.02)',
    boxShadow: theme.shadows[4],
    borderColor: theme.palette.primary.main,
    '& .role-card-button': {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
    },
  },
}));

interface RoleCardProps {
  title: string;
  description: string;
  helperText?: string;
  actionLabel?: string;
  onSelect: () => void;
  disabled?: boolean;
  selected?: boolean;
  icon?: React.ReactNode;
}

export default function RoleCard({
  title,
  description,
  helperText,
  actionLabel = 'Выбрать',
  onSelect,
  disabled,
  selected,
  icon,
}: RoleCardProps) {
  return (
    <HoverCard
      variant='outlined'
      sx={{
        borderColor: selected ? 'primary.main' : 'divider',
        borderWidth: selected ? 2 : 1,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 1.25, mb: 1.5 }}>
          {icon}
          <Typography variant='h5' fontWeight={700} sx={{ textTransform: 'uppercase' }}>
            {title}
          </Typography>
        </Box>
        <Typography variant='body1' color='text.secondary' sx={{ mb: 1.5 }}>
          {description}
        </Typography>
        {helperText && (
          <Typography variant='body2' color='text.secondary'>
            {helperText}
          </Typography>
        )}
      </CardContent>
      <CardActions sx={{ px: 2, pb: 3 }}>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant={selected ? 'contained' : 'outlined'}
          onClick={onSelect}
          disabled={disabled}
          fullWidth
          className='role-card-button'
        >
          {actionLabel}
        </Button>
      </CardActions>
    </HoverCard>
  );
}

'use client';

import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Avatar,
  Typography,
  ListItemIcon,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useUser, useClerk } from '@clerk/nextjs';
import ManageAccountsSharpIcon from '@mui/icons-material/ManageAccountsSharp';
import MailOutlineSharpIcon from '@mui/icons-material/MailOutlineSharp';
import ChecklistRtlSharpIcon from '@mui/icons-material/ChecklistRtlSharp';
import LogoutIcon from '@mui/icons-material/Logout';

const menu = [
  { name: 'Settings', path: '/settings', icon: <ManageAccountsSharpIcon /> },
  { name: 'Messages', path: '/messages', icon: <MailOutlineSharpIcon /> },
  { name: 'Reports', path: '/reports', icon: <ChecklistRtlSharpIcon /> },
  { name: 'Logout', action: 'logout', icon: <LogoutIcon /> },
];

export default function UserMenu() {
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const { user } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();

  const userName = user?.firstName + ' ' + user?.lastName;
  const userEmail = user?.emailAddresses[0]?.emailAddress;

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleMenuClick = async (setting: (typeof menu)[0]) => {
    handleCloseUserMenu();
    if (setting.action === 'logout') {
      await signOut({ redirectUrl: '/sign-in' });
    } else if (setting.path) {
      router.push(setting.path);
    }
  };

  return (
    <Box sx={{ flexGrow: 0 }}>
      <Tooltip title='Open menu'>
        <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
          <Avatar alt={userName || 'User'} src={user?.imageUrl || ''} />
        </IconButton>
      </Tooltip>
      <Menu
        id='menu-appbar'
        anchorEl={anchorElUser}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        open={Boolean(anchorElUser)}
        onClose={handleCloseUserMenu}
      >
        <Box sx={{ minWidth: 200, textAlign: 'center' }}>
          <Typography variant='button' margin='5px' fontWeight='bold'>
            {userName}
          </Typography>
          <Typography fontSize='0.85rem' color='text.secondary'>
            {userEmail}
          </Typography>
          {menu.map((setting) => (
            <MenuItem
              key={setting.name}
              onClick={() => handleMenuClick(setting)}
            >
              <ListItemIcon>{setting.icon}</ListItemIcon>
              <Typography textAlign='center' fontSize='0.9rem'>
                {setting.name}
              </Typography>
            </MenuItem>
          ))}
        </Box>
      </Menu>
    </Box>
  );
}

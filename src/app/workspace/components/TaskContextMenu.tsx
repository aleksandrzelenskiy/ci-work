//app/workspace/components/TaskContextMenu.tsx

'use client';

import React from 'react';
import {
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

type Props = {
    anchorPosition: { top: number; left: number } | null;
    onClose: () => void;
    onOpenTask?: () => void;
    onEditTask?: () => void;
    onDeleteTask?: () => void;
};

export default function TaskContextMenu({
                                            anchorPosition,
                                            onClose,
                                            onOpenTask,
                                            onEditTask,
                                            onDeleteTask,
                                        }: Props) {
    return (
        <Menu
            open={!!anchorPosition}
            onClose={onClose}
            anchorReference="anchorPosition"
            anchorPosition={anchorPosition ?? undefined}
            slotProps={{
                paper: { sx: { minWidth: 180, borderRadius: 2 } },
            }}
        >
            <MenuItem
                onClick={() => {
                    onOpenTask?.();
                    onClose();
                }}
            >
                <ListItemIcon>
                    <OpenInNewIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Открыть" />
            </MenuItem>

            <MenuItem
                onClick={() => {
                    onEditTask?.();
                    onClose();
                }}
            >
                <ListItemIcon>
                    <EditIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary="Редактировать" />
            </MenuItem>

            <Divider />

            <MenuItem
                onClick={() => {
                    onDeleteTask?.();
                    onClose();
                }}
                sx={{ color: 'error.main' }}
            >
                <ListItemIcon>
                    <DeleteOutlineIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText primary="Удалить" />
            </MenuItem>
        </Menu>
    );
}

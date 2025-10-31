// src/app/workspace/components/WorkspaceTaskDialog.tsx
'use client';

import * as React from 'react';
import {
    Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Stack, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

type Props = {
    open: boolean;
    org: string;
    projectId: string;
    /** имена с суффиксом Action, чтобы не ругался TS71007 */
    onCloseAction: () => void;
    onCreatedAction: () => void;
};

type Priority = 'urgent' | 'high' | 'medium' | 'low';

// noinspection SpellCheckingInspection
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genId(len = 5) {
    let s = '';
    for (let i = 0; i < len; i++) s += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
    return s;
}

export default function WorkspaceTaskDialog({
                                                open,
                                                org,
                                                projectId,
                                                onCloseAction,
                                                onCreatedAction,
                                            }: Props) {
    const [saving, setSaving] = React.useState(false);
    const [taskName, setTaskName] = React.useState('');
    const [bsNumber, setBsNumber] = React.useState('');
    const [bsAddress, setBsAddress] = React.useState('');
    const [priority, setPriority] = React.useState<Priority>('medium');
    const [dueDate, setDueDate] = React.useState<Date | null>(new Date());

    const reset = () => {
        setTaskName('');
        setBsNumber('');
        setBsAddress('');
        setPriority('medium');
        setDueDate(new Date());
    };

    const handleClose = () => {
        if (saving) return;
        reset();
        onCloseAction();
    };

    const handleCreate = async () => {
        if (!taskName || !bsNumber) return;
        setSaving(true);
        try {
            const payload = {
                taskId: genId(),
                taskName,
                bsNumber,
                bsAddress,
                status: 'TO DO',
                priority,
                dueDate: dueDate ? dueDate.toISOString() : undefined,
            };

            const res = await fetch(`/api/org/${org}/projects/${projectId}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                console.error('Failed to create task:', j.error || res.statusText);
                return;
            }

            reset();
            onCreatedAction();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
                <DialogTitle>Создать задачу</DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="Task Name"
                            value={taskName}
                            onChange={(e) => setTaskName(e.target.value)}
                            required
                            fullWidth
                        />
                        <Stack direction="row" spacing={2}>
                            <TextField
                                label="BS Number"
                                value={bsNumber}
                                onChange={(e) => setBsNumber(e.target.value)}
                                required
                                fullWidth
                            />
                            <TextField
                                label="BS Address"
                                value={bsAddress}
                                onChange={(e) => setBsAddress(e.target.value)}
                                fullWidth
                            />
                        </Stack>
                        <Stack direction="row" spacing={2}>
                            <FormControl fullWidth>
                                <InputLabel>Priority</InputLabel>
                                <Select
                                    label="Priority"
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value as Priority)}
                                >
                                    <MenuItem value="urgent">Urgent</MenuItem>
                                    <MenuItem value="high">High</MenuItem>
                                    <MenuItem value="medium">Medium</MenuItem>
                                    <MenuItem value="low">Low</MenuItem>
                                </Select>
                            </FormControl>
                            <DatePicker
                                label="Due Date"
                                value={dueDate}
                                onChange={(d) => setDueDate(d)}
                                slotProps={{ textField: { fullWidth: true } }}
                            />
                        </Stack>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} disabled={saving}>Отмена</Button>
                    <Button
                        onClick={handleCreate}
                        variant="contained"
                        disabled={saving || !taskName || !bsNumber}
                    >
                        Создать
                    </Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
}

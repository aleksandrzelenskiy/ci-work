// app/components/TaskForm.tsx

'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Chip,
  Stack,
  IconButton,
  Collapse,
  Alert,
  Autocomplete,
} from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useUser } from '@clerk/nextjs';
import { useDropzone } from 'react-dropzone';
import { Task, PriorityLevel } from '@/app/types/taskTypes';
import {
  KeyboardDoubleArrowUp as KeyboardDoubleArrowUpIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  DragHandle as DragHandleIcon,
  Remove as RemoveIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

interface User {
  clerkUserId: string;
  name: string;
  email: string;
  role: string;
}

interface TaskFormProps {
  open: boolean;
  task?: Task | null;
  initialData?: Partial<Task>;
  attachmentFiles?: File[];
  onClose: () => void;
  onSubmit: (taskData: FormData) => Promise<void>;
}

const generatetaskId = (): string => {
  const randomPart = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `${randomPart}`;
};

const TaskForm: React.FC<TaskFormProps> = ({
  open,
  task,
  initialData,
  attachmentFiles = [],
  onClose,
  onSubmit,
}) => {
  const { isLoaded, user } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [formData, setFormData] = useState<Partial<Task>>({
    taskId: generatetaskId(),
    taskName: '',
    taskDescription: '',
    priority: 'medium',
    dueDate: new Date(),
    bsNumber: '',
    bsAddress: '',
    totalCost: 0,
    authorId: '',
    authorName: '',
    authorEmail: '',
    initiatorId: '',
    initiatorName: '',
    initiatorEmail: '',
    executorId: '',
    executorName: '',
    executorEmail: '',
    attachments: [],
  });
  const [newAttachmentFiles, setNewAttachmentFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<string[]>([]);
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'error' | 'success' | 'info' | 'warning';
  }>({ open: false, message: '', severity: 'info' });

  const filterUsers = (options: User[], inputValue: string) => {
    return options.filter(
      (option) =>
        option.name.toLowerCase().includes(inputValue.toLowerCase()) ||
        option.email.toLowerCase().includes(inputValue.toLowerCase())
    );
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        const response = await fetch('/api/users');
        if (!response.ok) throw new Error('Error loading users');
        const data = await response.json();
        setUsers(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (task) {
      // Edit mode
      setFormData({
        ...task,
        dueDate: new Date(task.dueDate),
      });
      setExistingAttachments(task.attachments || []);
    } else if (initialData) {
      // Create mode with initial data
      setFormData({
        ...initialData,
        taskId: initialData.taskId || generatetaskId(),
        dueDate: initialData.dueDate || new Date(),
      });
    } else {
      // New task
      resetForm();
    }
    setNewAttachmentFiles(attachmentFiles);
  }, [open, task, initialData]);

  useEffect(() => {
    if (task) {
      setExistingAttachments(
        Array.isArray(task.attachments) ? task.attachments : []
      );
    }
  }, [task]);

  const resetForm = () => {
    setFormData({
      taskId: generatetaskId(),
      taskName: '',
      taskDescription: '',
      priority: 'medium',
      dueDate: new Date(),
      bsNumber: '',
      bsAddress: '',
      totalCost: 0,
      authorId: user?.id || '',
      authorName: getDisplayName(),
      authorEmail: user?.primaryEmailAddress?.emailAddress || '',
      initiatorId: '',
      initiatorName: '',
      initiatorEmail: '',
      executorId: '',
      executorName: '',
      executorEmail: '',
      attachments: [],
    });
    setExistingAttachments([]);
    setNewAttachmentFiles([]);
  };

  const getDisplayName = () => {
    if (user?.fullName) return user.fullName;
    if (user?.firstName && user?.lastName)
      return `${user.firstName} ${user.lastName}`;
    if (user?.username) return user.username;
    return user?.primaryEmailAddress?.emailAddress || 'Unknown User';
  };

  const getDisplayNameWithEmail = () => {
    const displayName = getDisplayName();
    const email = user?.primaryEmailAddress?.emailAddress;
    return email ? `${displayName} (${email})` : displayName;
  };

  const {
    getRootProps: getAttachmentRootProps,
    getInputProps: getAttachmentInputProps,
  } = useDropzone({
    onDrop: (acceptedFiles) =>
      setNewAttachmentFiles((prev) => [...prev, ...acceptedFiles]),
    multiple: true,
  });

  const handleSubmitForm = async () => {
    try {
      if (!formData.taskName || !formData.bsNumber || !formData.initiatorId) {
        showNotification('Please fill in all required fields', 'error');
        return;
      }

      const formDataToSend = new FormData();

      // Append main task data
      Object.entries(formData).forEach(([key, value]) => {
        if (value instanceof Date) {
          formDataToSend.append(key, value.toISOString());
        } else if (value !== null && value !== undefined) {
          formDataToSend.append(key, value.toString());
        }
      });

      // Append existing attachments
      formDataToSend.append(
        'existingAttachments',
        JSON.stringify(existingAttachments)
      );

      // Append new attachment files
      newAttachmentFiles.forEach((file, index) => {
        formDataToSend.append(`attachments_${index}`, file);
      });

      await onSubmit(formDataToSend);
      handleClose();
      showNotification('Task saved successfully!', 'success');
    } catch (err) {
      console.error('Error saving task:', err);
      showNotification(
        err instanceof Error ? err.message : 'Error saving task',
        'error'
      );
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const showNotification = (
    message: string,
    severity: 'error' | 'success' | 'info' | 'warning'
  ) => {
    setNotification({ open: true, message, severity });
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, open: false }));
    }, 5000);
  };

  if (!isLoaded) return null;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth='md'>
        <DialogTitle>
          {task ? 'Edit Task' : 'Create New Task'}
          {task && <Chip label={task.taskId} sx={{ ml: 2 }} />}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Collapse in={notification.open}>
              <Alert
                severity={notification.severity}
                action={
                  <IconButton
                    aria-label='close'
                    color='inherit'
                    size='small'
                    onClick={() =>
                      setNotification({ ...notification, open: false })
                    }
                  >
                    <CloseIcon fontSize='inherit' />
                  </IconButton>
                }
                sx={{ mb: 2 }}
              >
                {notification.message}
              </Alert>
            </Collapse>

            <TextField
              label='Task Name'
              value={formData.taskName}
              onChange={(e) =>
                setFormData({ ...formData, taskName: e.target.value })
              }
              fullWidth
              required
            />

            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label='BS Number'
                value={formData.bsNumber}
                onChange={(e) =>
                  setFormData({ ...formData, bsNumber: e.target.value })
                }
                fullWidth
                required
              />
              <TextField
                label='BS Address'
                value={formData.bsAddress}
                onChange={(e) =>
                  setFormData({ ...formData, bsAddress: e.target.value })
                }
                fullWidth
                required
              />
            </Box>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: e.target.value as PriorityLevel,
                    })
                  }
                  label='Priority'
                >
                  <MenuItem value='urgent'>
                    <Stack direction='row' alignItems='center' gap={1}>
                      <KeyboardDoubleArrowUpIcon sx={{ color: '#ff0000' }} />
                      <span>Urgent</span>
                    </Stack>
                  </MenuItem>
                  <MenuItem value='high'>
                    <Stack direction='row' alignItems='center' gap={1}>
                      <KeyboardArrowUpIcon sx={{ color: '#ca3131' }} />
                      <span>High</span>
                    </Stack>
                  </MenuItem>
                  <MenuItem value='medium'>
                    <Stack direction='row' alignItems='center' gap={1}>
                      <DragHandleIcon sx={{ color: '#df9b18' }} />
                      <span>Medium</span>
                    </Stack>
                  </MenuItem>
                  <MenuItem value='low'>
                    <Stack direction='row' alignItems='center' gap={1}>
                      <RemoveIcon sx={{ color: '#28a0e9' }} />
                      <span>Low</span>
                    </Stack>
                  </MenuItem>
                </Select>
              </FormControl>
              <DatePicker
                label='Due Date'
                value={formData.dueDate}
                onChange={(newValue) =>
                  setFormData({ ...formData, dueDate: newValue as Date })
                }
                sx={{ width: '100%' }}
              />
            </Box>

            <TextField
              label='Task Author'
              value={getDisplayNameWithEmail()}
              fullWidth
              disabled
              sx={{
                '& .MuiInputBase-input': {
                  color: 'rgba(0, 0, 0, 0.6)',
                  pointerEvents: 'none',
                },
              }}
            />

            <FormControl fullWidth sx={{ mt: 2 }}>
              <Autocomplete
                options={users}
                filterOptions={(options, { inputValue }) =>
                  filterUsers(options, inputValue)
                }
                getOptionLabel={(user) => `${user.name} (${user.email})`}
                value={
                  users.find(
                    (user) => user.clerkUserId === formData.executorId
                  ) || null
                }
                onChange={(_, newValue) => {
                  setFormData({
                    ...formData,
                    executorId: newValue?.clerkUserId || '',
                    executorName: newValue?.name || '',
                    executorEmail: newValue?.email || '',
                  });
                }}
                isOptionEqualToValue={(option, value) =>
                  option.clerkUserId === value.clerkUserId
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label='Executor'
                    InputProps={{
                      ...params.InputProps,
                      type: 'search',
                    }}
                  />
                )}
                loading={loadingUsers}
                loadingText='Loading users...'
                noOptionsText='No users found'
              />
            </FormControl>

            <FormControl fullWidth sx={{ mt: 2 }}>
              <Autocomplete
                options={users}
                filterOptions={(options, { inputValue }) =>
                  filterUsers(options, inputValue)
                }
                getOptionLabel={(user) => `${user.name} (${user.email})`}
                value={
                  users.find(
                    (user) => user.clerkUserId === formData.initiatorId
                  ) || null
                }
                onChange={(_, newValue) => {
                  setFormData({
                    ...formData,
                    initiatorId: newValue?.clerkUserId || '',
                    initiatorName: newValue?.name || '',
                    initiatorEmail: newValue?.email || '',
                  });
                }}
                isOptionEqualToValue={(option, value) =>
                  option.clerkUserId === value.clerkUserId
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label='Task Initiator'
                    InputProps={{
                      ...params.InputProps,
                      type: 'search',
                    }}
                    required
                  />
                )}
                loading={loadingUsers}
                loadingText='Loading users...'
                noOptionsText='No users found'
              />
            </FormControl>

            <TextField
              label='Task Description'
              value={formData.taskDescription}
              onChange={(e) =>
                setFormData({ ...formData, taskDescription: e.target.value })
              }
              multiline
              minRows={3}
              fullWidth
              required
            />

            <Box sx={{ mt: 2 }}>
              <Typography variant='subtitle1' gutterBottom>
                Attachments
              </Typography>
              <Stack
                direction='row'
                spacing={1}
                sx={{ flexWrap: 'wrap', gap: 1 }}
              >
                {existingAttachments.map((attachment, index) => (
                  <Chip
                    key={`existing-${index}`}
                    label={attachment.split('/').pop()}
                    onDelete={() => {
                      setExistingAttachments((prev) =>
                        prev.filter((_, i) => i !== index)
                      );
                    }}
                    deleteIcon={<CloseIcon />}
                    variant='outlined'
                  />
                ))}
                {newAttachmentFiles.map((file, index) => (
                  <Chip
                    key={`new-${index}`}
                    label={`${file.name} (${(file.size / 1024).toFixed(1)} KB)`}
                    onDelete={() => {
                      setNewAttachmentFiles((prev) =>
                        prev.filter((_, i) => i !== index)
                      );
                    }}
                    deleteIcon={<CloseIcon />}
                    variant='outlined'
                  />
                ))}
              </Stack>
              <Box
                {...getAttachmentRootProps()}
                sx={{
                  border: '2px dashed #1976d2',
                  borderRadius: 2,
                  padding: 4,
                  cursor: 'pointer',
                  marginTop: 2,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 100,
                }}
              >
                <input {...getAttachmentInputProps()} />
                <Typography variant='body1'>
                  Drag files here or click to select
                </Typography>
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmitForm}
            variant='contained'
            color='primary'
          >
            {task ? 'Save Changes' : 'Create Task'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default TaskForm;

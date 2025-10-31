// app/tasks/[taskId]/page.tsx
'use client';

import { FINANCE_CONFIG } from '@/config/finance';
import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
    Box,
    Typography,
    CircularProgress,
    Chip,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    AppBar,
    Toolbar,
    IconButton,
    Slide,
    TableContainer,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Link as MUILink,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Snackbar,
    Alert,
    Paper,
    TextField,
    Avatar,
    Grid,
} from '@mui/material';
import Tooltip from '@mui/material/Tooltip';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineOppositeContent from '@mui/lab/TimelineOppositeContent';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import TocOutlinedIcon from '@mui/icons-material/TocOutlined';
import HistoryIcon from '@mui/icons-material/History';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CommentOutlinedIcon from '@mui/icons-material/CommentOutlined';
import Skeleton from '@mui/material/Skeleton';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import { YMaps, Map, Placemark, FullscreenControl, TypeSelector, ZoomControl, GeolocationControl, SearchControl, } from '@pbe/react-yandex-maps';

import NextLink from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
    Task,
    WorkItem,
    BsLocation,
    CurrentStatus,
    TaskEvent,
} from '@/app/types/taskTypes';
import { TransitionProps } from '@mui/material/transitions';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';
import TaskForm from '@/app/components/TaskForm';
import { getStatusColor } from '@/utils/statusColors';
import { useDropzone } from 'react-dropzone';
import LinearProgress from '@mui/material/LinearProgress';

type TaskComment = Task['comments'] extends Array<infer T> ? T : never;

const parseUserInfo = (userString?: string) => {
    if (!userString) return { name: 'N/A', email: 'N/A' };
    const cleanedString = userString.replace(/\)$/, '');
    const parts = cleanedString.split(' (');
    return { name: parts[0] || 'N/A', email: parts[1] || 'N/A' };
};

// Helpers for robust estimate detection by folder path
const cleanUrlNoQuery = (url: string) =>
    decodeURIComponent(url.split('?')[0].split('#')[0]);

const isEstimateUrl = (url: string, taskId: string) => {
    try {
        const clean = cleanUrlNoQuery(url).toLowerCase();
        const id = (taskId || '').toLowerCase();
        if (!id) return false;
        // match .../uploads/<taskId>/<taskId>-estimate/ anywhere in the path
        const marker = `/uploads/${id}/${id}-estimate/`;
        return clean.includes(marker);
    } catch {
        return false;
    }
};

const Transition = React.forwardRef(function Transition(
    props: TransitionProps & { children: React.ReactElement },
    ref: React.Ref<unknown>
) {
    return <Slide direction="up" ref={ref} {...props} />;
});

export default function TaskDetailPage() {
    const params = useParams() as { taskId: string };
    const { taskId } = params;
    const router = useRouter();

    const [task, setTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [workItemsExpanded, setWorkItemsExpanded] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [confirmAction, setConfirmAction] =
        useState<'accept' | 'reject' | 'done' | 'refuse' | null>(null);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
    const [isEditFormOpen, setIsEditFormOpen] = useState(false);
    const [selectedMapPoint, setSelectedMapPoint] = useState<{ coords: [number, number]; title: string } | null>(null);
    const [mapOpen, setMapOpen] = useState(false);

    const [openOrderDialog, setOpenOrderDialog] = useState(false);
    const [orderData, setOrderData] = useState({
        orderNumber: '',
        orderDate: null as dayjs.Dayjs | null,
        orderSignDate: null as dayjs.Dayjs | null,
    });

    const [orderFile, setOrderFile] = useState<File | null>(null);
    const [uploadingOrder, setUploadingOrder] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number>(0);

    const [confirmDeleteOrderOpen, setConfirmDeleteOrderOpen] = useState(false);
    const [deletingOrder, setDeletingOrder] = useState(false);

    const [confirmDeleteNcwOpen, setConfirmDeleteNcwOpen] = useState(false);
    const [deletingNcw, setDeletingNcw] = useState(false);

    const [newCommentText, setNewCommentText] = useState('');
    const [newCommentPhoto, setNewCommentPhoto] = useState<File | null>(null);
    const [postingComment, setPostingComment] = useState(false);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        multiple: false,
        accept: {
            'application/pdf': ['.pdf'],
            'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
        },
        maxSize: 15 * 1024 * 1024,
        onDrop: (acceptedFiles) => {
            if (acceptedFiles?.length) setOrderFile(acceptedFiles[0]);
        },
    });

    const formatRuble = (value: number) => {
        const num = new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
        return `${num}\u00A0\u20BD`; // неразрывный пробел + ₽
    };

// парсер координат вида "52.283056 104.303778" (любой разделитель: пробел, запятая, точка с запятой)
    const parseCoords = (s?: string): [number, number] | null => {
        if (!s) return null;
        const parts = s.trim().split(/[ ,;]+/).map(Number).filter(n => !Number.isNaN(n));
        if (parts.length >= 2) return [parts[0], parts[1]] as [number, number];
        return null;
    };

    const openMapAt = (coordString: string, title: string) => {
        const coords = parseCoords(coordString);
        if (!coords) {
            setSnackbarMessage('Неверный формат координат');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return;
        }
        setSelectedMapPoint({ coords, title });
        setMapOpen(true);
    };


    useEffect(() => {
        const fetchUserRole = async () => {
            const user = await GetCurrentUserFromMongoDB();
            if (user.success) setUserRole(user.data.role);
        };
        void fetchUserRole();
    }, []);

    const agreedEvent = task?.events?.find(
        (e) => e.action === 'STATUS_CHANGED' && e.details?.newStatus === 'Agreed'
    );
    const completionDate = agreedEvent ? dayjs(agreedEvent.date).format('YYYY-MM-DD') : '';

    const updateStatus = async (newStatus: CurrentStatus) => {
        setLoadingStatus(true);
        try {
            const user = await GetCurrentUserFromMongoDB();
            if (!user.success) {
                setSnackbarMessage('Failed to fetch user data');
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
                return;
            }

            const event = {
                action: 'STATUS_CHANGED',
                author: user.data.name,
                authorId: user.data._id,
                details: { oldStatus: task?.status, newStatus },
            };

            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, event }),
            });

            if (!response.ok) {
                const errorData = (await response.json().catch(() => ({}))) as { error?: string };
                setSnackbarMessage(errorData.error || 'Failed to update status');
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
                return;
            }

            const { task: updatedTask } = (await response.json()) as { task: Task };
            setTask(updatedTask);
            setSnackbarMessage(
                newStatus === 'At work'
                    ? 'Task accepted successfully!'
                    : newStatus === 'Done'
                        ? 'Task marked as done successfully!'
                        : confirmAction === 'reject'
                            ? 'Task rejected successfully!'
                            : 'Task refused successfully!'
            );
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
        } catch (_err) {
            console.error('Error updating status:', _err);
            setSnackbarMessage('Failed to update task status');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        } finally {
            setLoadingStatus(false);
            setConfirmDialogOpen(false);
        }
    };

    const handleConfirmAction = async () => {
        if (!task) return;

        const bodyData: Record<string, string | null> = { decision: null };

        if (confirmAction === 'accept') {
            bodyData.decision = 'accept';
            bodyData.executorId = task.executorId;
        } else if (confirmAction === 'reject' || confirmAction === 'refuse') {
            bodyData.decision = 'reject';
            bodyData.executorId = task.executorId;
        } else if (confirmAction === 'done') {
            return await updateStatus('Done');
        }

        await fetch(`/api/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyData),
        });

        const response = await fetch(`/api/tasks/${taskId}`);
        const data = await response.json();
        setTask(data.task);
        setConfirmDialogOpen(false);
    };

    const handleCloseSnackbar = () => setSnackbarOpen(false);

    const handleSaveOrder = async () => {
        setUploadingOrder(true);
        setUploadProgress(0);
        try {
            const formData = new FormData();
            formData.append('orderNumber', orderData.orderNumber);
            if (orderData.orderDate) {
                formData.append('orderDate', orderData.orderDate.toDate().toISOString());
            }
            if (orderData.orderSignDate) {
                formData.append('orderSignDate', orderData.orderSignDate.toDate().toISOString());
            }
            if (orderFile) {
                formData.append('orderFile', orderFile);
            }

            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('PATCH', `/api/tasks/${taskId}`);

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        setUploadProgress(percent);
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const resp = JSON.parse(xhr.responseText) as { task: Task };
                            setTask(resp.task);
                            setSnackbarMessage('Order details saved successfully!');
                            setSnackbarSeverity('success');
                            setSnackbarOpen(true);
                            setOpenOrderDialog(false);
                            setOrderFile(null);
                            resolve();
                        } catch (parseErr) {
                            reject(parseErr);
                        }
                    } else {
                        reject(new Error(xhr.responseText || 'Failed to save order details'));
                    }
                };

                xhr.onerror = () => reject(new Error('Network error while uploading order'));
                xhr.send(formData);
            });
        } catch (_err) {
            console.error('Error saving order details:', _err);
            setSnackbarMessage('Failed to save order details');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        } finally {
            setUploadingOrder(false);
            setUploadProgress(0);
        }
    };

    const handleDeleteOrder = async () => {
        setDeletingOrder(true);
        try {
            const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}?file=order`, { method: 'DELETE' });
            const data = (await res.json().catch(() => ({}))) as { task?: Task; error?: string };
            if (!res.ok) {
                setSnackbarMessage(data.error || 'Failed to delete order file');
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
                return;
            }
            if (data.task) setTask(data.task);
            setSnackbarMessage('Order file deleted');
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
        } catch (_err) {
            console.error(_err);
            setSnackbarMessage('Failed to delete order file');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        } finally {
            setDeletingOrder(false);
            setConfirmDeleteOrderOpen(false);
        }
    };

    const handleDeleteNcw = async () => {
        setDeletingNcw(true);
        try {
            const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}?file=ncw`, { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setSnackbarMessage(data.error || 'Failed to delete NCW file');
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
                return;
            }
            const refreshed = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`).then(r => r.json());
            setTask(refreshed.task);
            setSnackbarMessage('NCW file deleted');
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
        } catch (e) {
            console.error(e);
            setSnackbarMessage('Failed to delete NCW file');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        } finally {
            setDeletingNcw(false);
            setConfirmDeleteNcwOpen(false);
        }
    };


    const handlePostComment = async () => {
        if (!newCommentText) return;
        setPostingComment(true);
        try {
            const formData = new FormData();
            formData.append('text', newCommentText);
            if (newCommentPhoto) formData.append('photo', newCommentPhoto);
            const res = await fetch(`/api/tasks/${taskId}/comments`, {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) {
                setSnackbarMessage('Failed to post comment');
                setSnackbarSeverity('error');
                setSnackbarOpen(true);
                return;
            }
            const data = (await res.json()) as { comment: TaskComment };
            setTask((prev) =>
                prev ? { ...prev, comments: [...(prev.comments || []), data.comment] } : prev
            );
            setNewCommentText('');
            setNewCommentPhoto(null);
        } catch (_err) {
            console.error(_err);
            setSnackbarMessage('Failed to post comment');
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        } finally {
            setPostingComment(false);
        }
    };

    useEffect(() => {
        const fetchTask = async () => {
            try {
                const response = await fetch(`/api/tasks/${taskId}`);
                const data = (await response.json()) as { task: Task; error?: string };
                if (!response.ok) {
                    setError(data.error || 'Failed to fetch task');
                    setLoading(false);
                    return;
                }
                setTask(data.task);
                setLoading(false);
            } catch (err) {
                console.error(err);
                setError('An unknown error occurred');
                setLoading(false);
            }
        };
        void fetchTask();
    }, [taskId]);

    if (loading) {
        return <CircularProgress sx={{ display: 'block', margin: '20px auto' }} />;
    }

    if (error) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="error" gutterBottom>
                    Error: {error}
                </Typography>
                <Box mb={2}>
                    <Button
                        component={NextLink}
                        href="/tasks"
                        variant="text"
                        startIcon={<ArrowBackIcon />}
                        sx={{ textTransform: 'uppercase' }}
                    >
                        To Tasks List
                    </Button>
                </Box>
            </Box>
        );
    }

    if (!task) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography gutterBottom>Task not found</Typography>
                <Box mb={2}>
                    <Button
                        component={NextLink}
                        href="/tasks"
                        variant="text"
                        startIcon={<ArrowBackIcon />}
                        sx={{ textTransform: 'uppercase' }}
                    >
                        To Tasks List
                    </Button>
                </Box>
            </Box>
        );
    }

    const isExecutor = userRole === 'executor';
    const isTaskAssigned = task.status === 'Assigned';
    const isTaskAtWork = task.status === 'At work';

    // ---- estimate: files living under /uploads/<taskId>/<taskId>-estimate/ ----
    const allAttachments = task.attachments ?? [];
    const estimateFiles = allAttachments.filter((url) => isEstimateUrl(url, task.taskId));
    // remove all estimate files from visible attachments
    const otherAttachments = allAttachments.filter((url) => !isEstimateUrl(url, task.taskId));
    const disallowedStatuses: CurrentStatus[] = ['To do', 'Assigned', 'At work'];

    return (
        <Box sx={{ maxWidth: 1200, margin: '0 auto', fontFamily: '"Roboto","Inter","Segoe UI",Arial,sans-serif' }}>

        <Box mb={2}>
                <Button
                    component={NextLink}
                    href="/tasks"
                    variant="text"
                    startIcon={<ArrowBackIcon />}
                    sx={{ textTransform: 'uppercase' }}
                >
                    To Tasks List
                </Button>
            </Box>

            <Box
                sx={{
                    mb: 3,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 2,
                    flexWrap: 'wrap',
                }}
            >
                <Typography variant="h5" component="h1">
                    {task.taskName} | {task.bsNumber} &nbsp;
                    <Chip
                        label={String(task.status)}
                        sx={{ backgroundColor: getStatusColor(task.status), color: '#fff' }}
                    />
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, flexWrap: 'wrap' }}>
                <Chip label={String(task.taskId)} color="default" />
                {userRole !== 'executor' && (
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => setIsEditFormOpen(true)}
                    >
                        Edit
                    </Button>
                )}


                {userRole !== 'executor' &&
                    !task.ncwUrl &&
                    !disallowedStatuses.includes(task.status) && (
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                                router.push(
                                    `/ncw?taskId=${encodeURIComponent(task.taskId)}` +
                                    `&orderNumber=${encodeURIComponent(task.orderNumber || '')}` +
                                    `&orderDate=${encodeURIComponent(
                                        task.orderDate ? dayjs(task.orderDate).format('YYYY-MM-DD') : ''
                                    )}` +
                                    `&completionDate=${encodeURIComponent(completionDate)}` +
                                    `&objectNumber=${encodeURIComponent(task.bsNumber)}` +
                                    `&objectAddress=${encodeURIComponent(task.bsAddress)}`
                                );
                            }}
                        >
                            NCW
                        </Button>
                    )}


                <Typography variant="body2" component="span">
                    Created by{' '}
                    {task.events?.find((event) => event.action === 'TASK_CREATED')?.author ||
                        task.authorName}{' '}
                    on{' '}
                    {new Date(
                        task.events?.find((event) => event.action === 'TASK_CREATED')?.date ||
                        task.createdAt
                    ).toLocaleDateString()}
                </Typography>
            </Box>

            <Grid container spacing={3}>
                {/* Левая колонка */}
                <Grid item xs={12} md={6}>
                    <Box sx={{ mb: 3 }}>
                        <Accordion defaultExpanded>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="h6">
                                    <InfoOutlinedIcon /> Basic Information
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography>
                                    <strong>BS:</strong> {task.bsNumber}
                                </Typography>
                                <Typography>
                                    <strong>Address:</strong> {task.bsAddress}
                                </Typography>

                                <Typography>
                                    <strong>
                                        {userRole
                                            ? userRole === 'executor'
                                                ? 'Cost:'
                                                : 'Total Cost:'
                                            : 'Loading...'}
                                    </strong>{' '}
                                    {userRole ? (
                                        (() => {
                                            const total = task.totalCost;
                                            const commission = total * FINANCE_CONFIG.COMMISSION_PERCENT;
                                            const sumToPay = total * FINANCE_CONFIG.SUM_TO_PAY_PERCENT;
                                            const tax =
                                                (total * (1 - FINANCE_CONFIG.COMMISSION_PERCENT)) *
                                                FINANCE_CONFIG.TAX_PERCENT_OF_REMAINING;
                                            const profit = total - (commission + sumToPay + tax);

                                            if (userRole === 'executor') {
                                                return formatRuble(sumToPay);
                                            } else {
                                                return (
                                                    <Tooltip
                                                        title={
                                                            <Box sx={{ p: 1 }}>
                                                                <Typography variant="body2">
                                                                    <strong>Commission:</strong> {formatRuble(commission)}
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    <strong>Tax:</strong> {formatRuble(tax)}
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    <strong>Sum to Pay:</strong> {formatRuble(sumToPay)}
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    <strong>Profit:</strong> {formatRuble(profit)}
                                                                </Typography>
                                                            </Box>
                                                        }
                                                        arrow
                                                        placement="top"
                                                    >
                                                        <Typography
                                                            component="span"
                                                            sx={{
                                                                cursor: 'help',
                                                                borderBottom: '1px dotted gray',
                                                                '&:hover': { color: 'primary.main' },
                                                            }}
                                                        >
                                                            {formatRuble(total)}
                                                        </Typography>
                                                    </Tooltip>
                                                );
                                            }
                                        })()
                                    ) : (
                                        <Skeleton variant="text" width={100} />
                                    )}
                                </Typography>


                                <Typography>
                                    <strong>Priority:</strong> {task.priority}
                                </Typography>
                                <Typography>
                                    <strong>Created:</strong> {dayjs(task.createdAt).format('DD.MM.YYYY')}
                                </Typography>
                                <Typography>
                                    <strong>Due Date:</strong> {new Date(task.dueDate).toLocaleDateString()}
                                </Typography>

                                {task.workCompletionDate && (
                                    <Typography>
                                        <strong>Work completion date (NCW):</strong>{' '}
                                        {dayjs(task.workCompletionDate).format('DD.MM.YYYY')}
                                    </Typography>
                                )}

                                {task.orderNumber && task.orderDate && (
                                    <>
                                        <Typography>
                                            <strong>Order Number:</strong> {task.orderNumber}
                                        </Typography>
                                        <Typography>
                                            <strong>Order Date:</strong> {dayjs(task.orderDate).format('DD.MM.YYYY')}
                                        </Typography>
                                        <Typography>
                                            <strong>Order Sign Date:</strong>{' '}
                                            {task.orderSignDate ? dayjs(task.orderSignDate).format('DD.MM.YYYY') : 'N/A'}
                                        </Typography>
                                    </>
                                )}

                                {userRole === 'admin' && (
                                    <Box
                                        sx={{
                                            mt: 1,
                                            display: 'flex',
                                            gap: 1,
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<DescriptionOutlinedIcon />}
                                            onClick={() => {
                                                setOrderData({
                                                    orderNumber: task.orderNumber || '',
                                                    orderDate: task.orderDate ? dayjs(task.orderDate) : null,
                                                    orderSignDate: task.orderSignDate ? dayjs(task.orderSignDate) : null,
                                                });
                                                setOrderFile(null);
                                                setOpenOrderDialog(true);
                                            }}
                                        >
                                            {task.orderNumber ? 'Edit Order' : 'Add Order'}
                                        </Button>

                                    </Box>
                                )}
                            </AccordionDetails>
                        </Accordion>
                    </Box>

                    <Box>
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="h6">
                                    <LocationOnOutlinedIcon /> Locations
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                {task.bsLocation.map((location: BsLocation) => (
                                    <Box key={uuidv4()} sx={{ mb: 1 }}>
                                        <Typography>
                                            <strong>{location.name}</strong>
                                        </Typography>

                                        <MUILink
                                            component="button"
                                            onClick={() => openMapAt(location.coordinates, location.name)}
                                            sx={{ cursor: 'pointer', textDecoration: 'none' }}
                                        >
                                            {location.coordinates}
                                        </MUILink>
                                    </Box>
                                ))}
                            </AccordionDetails>

                        </Accordion>
                    </Box>
                </Grid>

                {/* Правая колонка */}
                <Grid item xs={12} md={6}>
                    <Box sx={{ mb: 3 }}>
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="h6">
                                    <DescriptionOutlinedIcon /> Description
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography>{task.taskDescription}</Typography>
                            </AccordionDetails>
                        </Accordion>
                    </Box>

                    {/* Admin-only Documents */}
                    {userRole === 'admin' && (
                        <Box sx={{ mb: 3 }}>
                            <Accordion defaultExpanded>
                                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                    <Typography variant="h6">Documents</Typography>
                                </AccordionSummary>
                                <AccordionDetails>
                                    {/* Estimate (all files from estimate folder) */}
                                    {estimateFiles.length > 0 ? (
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="subtitle2">Estimate</Typography>
                                            {estimateFiles.map((url, i) => {
                                                const filename = cleanUrlNoQuery(url).split('/').pop() || `estimate_${i + 1}`;
                                                return (
                                                    <Button
                                                        key={`estimate-${i}`}
                                                        component="a"
                                                        href={url}
                                                        download
                                                        startIcon={<CloudDownloadIcon />}
                                                        sx={{ mt: 1, mr: 1 }}
                                                    >
                                                        {filename}
                                                    </Button>
                                                );
                                            })}
                                        </Box>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                            No estimate uploaded
                                        </Typography>
                                    )}

                                    {/* Order */}
                                    {task.orderUrl ? (
                                        <Box sx={{ mb: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="subtitle2" component="div">Order</Typography>
                                                <Tooltip title="Delete Order">
                                                    <IconButton size="small" aria-label="Delete Order" onClick={() => setConfirmDeleteOrderOpen(true)}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>

                                            <Button
                                                component="a"
                                                href={task.orderUrl}
                                                download
                                                startIcon={<CloudDownloadIcon />}
                                                sx={{ mt: 1 }}
                                            >

                                                {(task.orderNumber || 'order') +
                                                    (task.orderDate ? `_${dayjs(task.orderDate).format('YYYY-MM-DD')}` : '')}
                                            </Button>
                                        </Box>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                            No order file
                                        </Typography>
                                    )}

                                    {/* NCW (уведомление о завершении работ) */}
                                    {task.ncwUrl ? (
                                        <Box sx={{ mb: 2 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography variant="subtitle2" component="div">NCW (уведомление)</Typography>
                                                <Tooltip title="Delete NCW">
                                                    <IconButton
                                                        size="small"
                                                        aria-label="Delete NCW"
                                                        onClick={() => setConfirmDeleteNcwOpen(true)}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>


                                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                                                <Button
                                                    component="a"
                                                    href={task.ncwUrl}
                                                    download
                                                    startIcon={<CloudDownloadIcon />}
                                                >
                                                    {decodeURIComponent(task.ncwUrl.split('/').pop() || 'ncw.pdf')}
                                                </Button>

                                            </Box>
                                        </Box>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                            No NCW uploaded
                                        </Typography>
                                    )}


                                    {/* Closing Documents */}
                                    {task.closingDocumentsUrl ? (
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="subtitle2">Closing Documents</Typography>
                                            <Button
                                                component="a"
                                                href={task.closingDocumentsUrl}
                                                download
                                                startIcon={<CloudDownloadIcon />}
                                                sx={{ mt: 1 }}
                                            >
                                                {decodeURIComponent(task.closingDocumentsUrl.split('/').pop() || 'documents')}
                                            </Button>
                                        </Box>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary">
                                            No closing documents
                                        </Typography>
                                    )}
                                </AccordionDetails>
                            </Accordion>
                        </Box>
                    )}

                    <Box sx={{ mb: 3 }}>
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="h6">
                                    <AttachFileIcon /> Attachments
                                    <Chip
                                        label={String(otherAttachments.length)}
                                        color={otherAttachments.length === 0 ? 'default' : 'primary'}
                                        size="small"
                                        sx={{ ml: 1 }}
                                    />
                                </Typography>
                            </AccordionSummary>

                            <AccordionDetails>
                                {otherAttachments.length > 0 ? (
                                    otherAttachments.map((fileUrl: string, index: number) => {
                                        const fileName = fileUrl.split('/').pop() || `attachment_${index + 1}`;
                                        return (
                                            <Box key={`attachment-${index}`} sx={{ mb: 2 }}>
                                                <Typography variant="body1">{fileName}</Typography>
                                                <Button
                                                    component="a"
                                                    href={fileUrl}
                                                    download={fileName}
                                                    startIcon={<CloudDownloadIcon />}
                                                    sx={{ mt: 1 }}
                                                >
                                                    Download
                                                </Button>
                                            </Box>
                                        );
                                    })
                                ) : (
                                    <Typography variant="body2" color="text.secondary">
                                        No attachments found
                                    </Typography>
                                )}
                            </AccordionDetails>
                        </Accordion>
                    </Box>

                    <Box sx={{ mb: 3 }}>
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="h6">
                                    <GroupOutlinedIcon /> Participants
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography>
                                    <strong>Author:</strong> {parseUserInfo(task.authorName).name}
                                </Typography>
                                <Typography>
                                    <strong>Email:</strong> {parseUserInfo(task.authorEmail).name}
                                </Typography>
                                <Typography sx={{ mt: 2 }}>
                                    <strong>Initiator:</strong> {parseUserInfo(task.initiatorName).name}
                                </Typography>
                                <Typography>
                                    <strong>Email:</strong> {parseUserInfo(task.initiatorEmail).name}
                                </Typography>
                                <Typography sx={{ mt: 2 }}>
                                    <strong>Executor:</strong> {parseUserInfo(task.executorName).name}
                                </Typography>
                                <Typography>
                                    <strong>Email:</strong> {parseUserInfo(task.executorEmail).name}
                                </Typography>
                            </AccordionDetails>
                        </Accordion>
                    </Box>

                    {(task.status === 'Done' ||
                            task.status === 'Pending' ||
                            task.status === 'Issues' ||
                            task.status === 'Fixed' ||
                            task.status === 'Agreed') &&
                        task.photoReports &&
                        task.photoReports.length > 0 && (
                            <Box sx={{ mb: 3 }}>
                                <Accordion defaultExpanded>
                                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                        <Typography variant="h6">Task Reports</Typography>
                                    </AccordionSummary>
                                    <AccordionDetails>
                                        <Grid container spacing={2}>
                                            {task.photoReports.map((report) => (
                                                <Grid item xs={12} sm={6} key={report._id}>
                                                    <MUILink
                                                        component={NextLink}
                                                        href={`/reports/${encodeURIComponent(report.task)}/${report.baseId}`}
                                                        underline="none"
                                                        sx={{ display: 'block' }}
                                                    >
                                                        <Paper elevation={1} sx={{ p: 2 }}>
                                                            <Box display="flex" justifyContent="space-between" mb={1}>
                                                                <Typography variant="subtitle1">BS: {report.baseId}</Typography>
                                                                <Chip
                                                                    label={String(report.status)}
                                                                    size="small"
                                                                    sx={{
                                                                        backgroundColor: getStatusColor(report.status),
                                                                        color: '#fff',
                                                                    }}
                                                                />
                                                            </Box>
                                                            <Typography variant="body2" color="text.secondary" mb={2}>
                                                                Created at: {new Date(report.createdAt).toLocaleDateString()}
                                                            </Typography>
                                                            <Box display="flex">
                                                                {report.status === 'Agreed' && (
                                                                    <Button
                                                                        variant="contained"
                                                                        size="small"
                                                                        startIcon={<CloudDownloadIcon />}
                                                                        onClick={async (e) => {
                                                                            e.preventDefault();
                                                                            try {
                                                                                const response = await fetch(
                                                                                    `/api/reports/${encodeURIComponent(
                                                                                        report.task
                                                                                    )}/${report.baseId}/download`
                                                                                );
                                                                                if (!response.ok) throw new Error('Failed to download');
                                                                                const blob = await response.blob();
                                                                                const url = window.URL.createObjectURL(blob);
                                                                                const link = document.createElement('a');
                                                                                link.href = url;
                                                                                link.setAttribute('download', `report_${report.baseId}.zip`);
                                                                                document.body.appendChild(link);
                                                                                link.click();
                                                                                link.parentNode?.removeChild(link);
                                                                            } catch (_err) {
                                                                                console.error('Download error:', _err);
                                                                                setSnackbarMessage('Ошибка при скачивании отчета');
                                                                                setSnackbarSeverity('error');
                                                                                setSnackbarOpen(true);
                                                                            }
                                                                        }}
                                                                    >
                                                                        Download
                                                                    </Button>
                                                                )}
                                                            </Box>
                                                        </Paper>
                                                    </MUILink>
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </AccordionDetails>
                                </Accordion>
                            </Box>
                        )}

                    <Box sx={{ textAlign: 'center' }}>
                        {isExecutor &&
                            (task.status === 'Done' ||
                                task.status === 'Pending' ||
                                task.status === 'Issues' ||
                                task.status === 'Fixed' ||
                                task.status === 'Agreed') && (
                                <Box>
                                    <Button
                                        component={NextLink}
                                        href={`/upload?taskId=${
                                            task.taskId
                                        }&taskName=${encodeURIComponent(task.taskName)}&bsNumber=${encodeURIComponent(
                                            task.bsNumber
                                        )}&executorName=${encodeURIComponent(
                                            task.executorName
                                        )}&executorId=${task.executorId}&initiatorName=${encodeURIComponent(
                                            task.initiatorName
                                        )}&initiatorId=${task.initiatorId}`}
                                        variant="outlined"
                                        startIcon={<CloudUploadIcon />}
                                    >
                                        Upload reports
                                    </Button>
                                </Box>
                            )}
                    </Box>
                </Grid>

                {/* Work Items */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary
                            expandIcon={workItemsExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            onClick={() => setWorkItemsExpanded(!workItemsExpanded)}
                        >
                            <Typography variant="h6">
                                <TocOutlinedIcon /> Work Items
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Work Type</TableCell>
                                            <TableCell>Quantity</TableCell>
                                            <TableCell>Unit</TableCell>
                                            <TableCell>Note</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {task.workItems.map((item: WorkItem) => (
                                            <TableRow key={uuidv4()}>
                                                <TableCell>{item.workType}</TableCell>
                                                <TableCell>{item.quantity}</TableCell>
                                                <TableCell>{item.unit}</TableCell>
                                                <TableCell>{item.note}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* Кнопки статусов */}
                <Grid item xs={12}>
                    {isExecutor && isTaskAssigned && (
                        <Box sx={{ mb: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                                <Button
                                    variant="contained"
                                    color="success"
                                    onClick={() => {
                                        setConfirmAction('accept');
                                        setConfirmDialogOpen(true);
                                    }}
                                    disabled={loadingStatus}
                                >
                                    {loadingStatus ? <CircularProgress size={24} /> : 'Accept'}
                                </Button>
                                <Button
                                    variant="contained"
                                    color="error"
                                    onClick={() => {
                                        setConfirmAction('reject');
                                        setConfirmDialogOpen(true);
                                    }}
                                    disabled={loadingStatus}
                                >
                                    {loadingStatus ? <CircularProgress size={24} /> : 'Reject'}
                                </Button>
                            </Box>
                        </Box>
                    )}

                    {isExecutor && isTaskAtWork && (
                        <Box sx={{ mb: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => {
                                        setConfirmAction('done');
                                        setConfirmDialogOpen(true);
                                    }}
                                    disabled={loadingStatus}
                                >
                                    {loadingStatus ? <CircularProgress size={24} /> : 'Done'}
                                </Button>
                                <Button
                                    variant="contained"
                                    color="error"
                                    onClick={() => {
                                        setConfirmAction('refuse');
                                        setConfirmDialogOpen(true);
                                    }}
                                    disabled={loadingStatus}
                                >
                                    {loadingStatus ? <CircularProgress size={24} /> : 'Refuse'}
                                </Button>
                            </Box>
                        </Box>
                    )}
                </Grid>

                {/* Комментарии */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="h6">
                                <CommentOutlinedIcon sx={{ mr: 1 }} />
                                Comments
                                {task.comments && task.comments.length > 0 && (
                                    <Chip label={String(task.comments.length)} color="primary" size="small" sx={{ ml: 1 }} />
                                )}
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            {task.comments && task.comments.length > 0 ? (
                                task.comments.map((comment) => (
                                    <Box
                                        key={comment._id}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            mb: 2,
                                            borderBottom: '1px solid #ccc',
                                            pb: 1,
                                        }}
                                    >
                                        <Avatar
                                            src={comment.profilePic}
                                            alt={comment.author}
                                            sx={{ width: 32, height: 32, mr: 1 }}
                                        />
                                        <Box>
                                            <Typography variant="body1">{comment.text}</Typography>
                                            {comment.photoUrl && (
                                                <Box
                                                    component="img"
                                                    src={comment.photoUrl}
                                                    alt="Comment photo"
                                                    sx={{ maxWidth: '100%', mt: 1 }}
                                                />
                                            )}
                                            <Typography variant="caption" color="textSecondary">
                                                {comment.author} - {new Date(comment.createdAt).toLocaleString()}
                                            </Typography>
                                        </Box>
                                    </Box>
                                ))
                            ) : (
                                <Typography variant="body2" color="textSecondary">
                                    No comments yet
                                </Typography>
                            )}
                            <Box sx={{ mt: 2 }}>
                                <TextField
                                    label="Add a comment"
                                    multiline
                                    rows={3}
                                    fullWidth
                                    value={newCommentText}
                                    onChange={(e) => setNewCommentText(e.target.value)}
                                />
                                <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Button variant="text" startIcon={<AttachFileIcon />} component="label">
                                        Add photo
                                        <input
                                            type="file"
                                            hidden
                                            accept="image/*"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setNewCommentPhoto(e.target.files[0]);
                                                }
                                            }}
                                        />
                                    </Button>
                                    {newCommentPhoto && <Typography variant="body2">{newCommentPhoto.name}</Typography>}
                                </Box>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        sx={{ mt: 2 }}
                                        onClick={handlePostComment}
                                        disabled={postingComment}
                                    >
                                        {postingComment ? <CircularProgress size={24} /> : 'Post Comment'}
                                    </Button>
                                </Box>
                            </Box>
                        </AccordionDetails>
                    </Accordion>
                </Grid>

                {/* История */}
                <Grid item xs={12}>
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="h6">
                                <HistoryIcon /> Task History
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Timeline>
                                {task.events?.map((event: TaskEvent) => (
                                    <TimelineItem key={event._id}>
                                        <TimelineOppositeContent sx={{ py: '12px', px: 2 }}>
                                            <Typography variant="body2" color="textSecondary">
                                                {dayjs(event.date).format('DD.MM.YYYY')}
                                                <br />
                                                {dayjs(event.date).format('HH:mm')}
                                            </Typography>
                                        </TimelineOppositeContent>
                                        <TimelineSeparator>
                                            <TimelineDot
                                                color={
                                                    event.action === 'TASK_CREATED'
                                                        ? 'secondary'
                                                        : event.action === 'STATUS_CHANGED'
                                                            ? 'primary'
                                                            : 'grey'
                                                }
                                            >
                                                {event.action === 'TASK_CREATED' && <CheckIcon fontSize="small" />}
                                                {event.action === 'STATUS_CHANGED' && <ExpandMoreIcon fontSize="small" />}
                                            </TimelineDot>
                                            <TimelineConnector />
                                        </TimelineSeparator>
                                        <TimelineContent sx={{ py: '12px', px: 2 }}>
                                            <Typography variant="body1" component="div">
                                                {event.action.replace('_', ' ')}
                                            </Typography>
                                            <Typography variant="body2" component="div">
                                                Author: {parseUserInfo(event.author).name}
                                            </Typography>
                                            {event.details && (
                                                <Typography variant="caption" color="textSecondary">
                                                    {event.details.oldStatus && `From: ${event.details.oldStatus}`}
                                                    {event.details.newStatus && ` → To: ${event.details.newStatus}`}
                                                    {event.details.comment && ` (${event.details.comment})`}
                                                </Typography>
                                            )}
                                        </TimelineContent>
                                    </TimelineItem>
                                ))}
                            </Timeline>
                            {!task.events?.length && (
                                <Typography variant="body2" color="textSecondary" sx={{ p: 2 }}>
                                    No events recorded for this task
                                </Typography>
                            )}
                        </AccordionDetails>
                    </Accordion>
                </Grid>
            </Grid>

            {/* Фуллскрин-карта */}
            <Dialog fullScreen open={mapOpen} onClose={() => setMapOpen(false)} slots={{ transition: Transition }}>
                <AppBar sx={{ position: 'relative' }}>
                    <Toolbar>
                        <IconButton edge="start" color="inherit" onClick={() => setMapOpen(false)} aria-label="close">
                            <CloseIcon />
                        </IconButton>
                        <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
                            {selectedMapPoint?.title ?? 'Map'}
                        </Typography>
                    </Toolbar>
                </AppBar>

                <Box sx={{ height: '100%', width: '100%' }}>
                    <YMaps query={{ apikey: '1c3860d8-3994-4e6e-841b-31ad57f69c78', lang: 'ru_RU' }}>
                        <Map
                            state={
                                selectedMapPoint
                                    ? { center: selectedMapPoint.coords, zoom: 14, type: 'yandex#hybrid' } // было yandex#satellite
                                    : { center: [55.751244, 37.618423], zoom: 4, type: 'yandex#map' }
                            }
                            width="100%"
                            height="100%"
                            modules={[
                                'control.ZoomControl',
                                'control.TypeSelector',
                                'control.FullscreenControl',
                                'control.GeolocationControl',
                                'control.SearchControl',
                                'geoObject.addon.balloon',
                            ]}
                        >
                            {/* Контролы, чтобы можно было менять слои и искать адреса */}
                            <ZoomControl />
                            <TypeSelector />
                            <GeolocationControl />
                            <SearchControl />

                            {selectedMapPoint && (
                                <Placemark
                                    geometry={selectedMapPoint.coords}
                                    options={{ preset: 'islands#blueStretchyIcon', iconColor: '#ff0000' }}
                                    properties={{ balloonContent: selectedMapPoint.title, iconContent: `BS: ${selectedMapPoint.title}` }}
                                />
                            )}
                            <FullscreenControl />
                        </Map>
                    </YMaps>

                </Box>
            </Dialog>


            {/* Подтверждение смены статуса */}
            <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
                <DialogTitle>
                    {confirmAction === 'accept' &&
                        `Are you sure you want to accept the task ${task.taskName} | ${task.bsNumber}?`}
                    {confirmAction === 'reject' &&
                        `Are you sure you want to reject the task ${task.taskName} | ${task.bsNumber}?`}
                    {confirmAction === 'done' &&
                        `Are you sure you want to mark the task ${task.taskName} | ${task.bsNumber} as done?`}
                    {confirmAction === 'refuse' &&
                        `Are you sure you want to refuse the task ${task.taskName} | ${task.bsNumber}?`}
                </DialogTitle>
                <DialogContent>
                    {(confirmAction === 'accept' || confirmAction === 'done') && (
                        <Typography>The due date is {dayjs(task.dueDate).format('DD.MM.YYYY')}.</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDialogOpen(false)} color="primary" variant="outlined">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmAction}
                        color={confirmAction === 'accept' || confirmAction === 'done' ? 'primary' : 'error'}
                        variant="contained"
                    >
                        {confirmAction === 'accept' && 'Accept'}
                        {confirmAction === 'reject' && 'Reject'}
                        {confirmAction === 'done' && 'Mark Done'}
                        {confirmAction === 'refuse' && 'Refuse'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог заказа (admin) */}
            {userRole === 'admin' && (
                <Dialog open={openOrderDialog} onClose={() => setOpenOrderDialog(false)} fullWidth maxWidth="sm">
                    <DialogTitle>{task.orderNumber ? 'Edit Order Details' : 'Add Order Details'}</DialogTitle>
                    <DialogContent>
                        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <TextField
                                label="Order Number"
                                value={orderData.orderNumber}
                                onChange={(e) => setOrderData({ ...orderData, orderNumber: e.target.value })}
                                fullWidth
                            />

                            <LocalizationProvider dateAdapter={AdapterDayjs}>
                                <DatePicker
                                    label="Order Date"
                                    value={orderData.orderDate}
                                    onChange={(newValue) => setOrderData({ ...orderData, orderDate: newValue })}
                                    format="DD.MM.YYYY"
                                    slotProps={{ textField: { fullWidth: true } }}
                                />

                                <DatePicker
                                    label="Order Sign Date"
                                    value={orderData.orderSignDate}
                                    onChange={(newValue) => setOrderData({ ...orderData, orderSignDate: newValue })}
                                    format="DD.MM.YYYY"
                                    slotProps={{ textField: { fullWidth: true } }}
                                />

                                {task.orderUrl ? (
                                    <Box sx={{ mt: 1 }}>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Current file
                                        </Typography>

                                        <Button
                                            component="a"
                                            href={task.orderUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            startIcon={<CloudDownloadIcon />}
                                            variant="text"
                                            sx={{ p: 0, minWidth: 0 }}
                                        >
                                            {(task.orderNumber || 'Order') +
                                                (task.orderDate ? ` от ${dayjs(task.orderDate).format('DD.MM.YYYY')}` : '')}
                                        </Button>

                                        <Box sx={{ mt: 1 }}>
                                            <Button color="error" variant="outlined" onClick={() => setConfirmDeleteOrderOpen(true)}>
                                                Delete file
                                            </Button>
                                        </Box>

                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                                            Delete the current file to upload a new one.
                                        </Typography>
                                    </Box>
                                ) : (
                                    <>
                                        <Box
                                            {...getRootProps()}
                                            sx={{
                                                border: '2px dashed',
                                                borderColor: isDragActive ? 'primary.main' : 'grey.400',
                                                borderRadius: 2,
                                                p: 3,
                                                textAlign: 'center',
                                                cursor: 'pointer',
                                                backgroundColor: isDragActive ? 'action.hover' : 'transparent',
                                                transition: 'all 0.2s ease-in-out',
                                            }}
                                        >
                                            <input {...getInputProps()} />
                                            <Typography variant="subtitle2" gutterBottom>
                                                Signed Order (PDF or Image)
                                            </Typography>
                                            {orderFile ? (
                                                <Typography variant="body2">Selected: {orderFile.name}</Typography>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">
                                                    Drag & drop file here, or click to select
                                                </Typography>
                                            )}
                                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                                                Allowed: PDF, JPG, PNG (up to 15&nbsp;MB)
                                            </Typography>
                                        </Box>

                                        {uploadingOrder && (
                                            <Box sx={{ mt: 2 }}>
                                                <LinearProgress variant="determinate" value={uploadProgress} />
                                                <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                                                    Uploading… {uploadProgress}%
                                                </Typography>
                                            </Box>
                                        )}
                                    </>
                                )}
                            </LocalizationProvider>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={() => {
                                setOpenOrderDialog(false);
                                setOrderFile(null);
                            }}
                            color="primary"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveOrder}
                            color="primary"
                            variant="contained"
                            disabled={uploadingOrder}
                            startIcon={uploadingOrder ? <CircularProgress size={20} color="inherit" /> : null}
                        >
                            {uploadingOrder ? 'Uploading…' : 'Save'}
                        </Button>
                    </DialogActions>
                </Dialog>
            )}

            {/* Подтверждение удаления файла заказа */}
            <Dialog open={confirmDeleteOrderOpen} onClose={() => setConfirmDeleteOrderOpen(false)}>
                <DialogTitle>Delete order file?</DialogTitle>
                <DialogContent>
                    <Typography>Current order file will be permanently removed.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDeleteOrderOpen(false)}>Cancel</Button>
                    <Button onClick={handleDeleteOrder} color="error" variant="contained" disabled={deletingOrder}>
                        {deletingOrder ? <CircularProgress size={20} color="inherit" /> : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Подтверждение удаления файла уведомления */}
            <Dialog open={confirmDeleteNcwOpen} onClose={() => setConfirmDeleteNcwOpen(false)}>
                <DialogTitle>Delete NCW file?</DialogTitle>
                <DialogContent>
                    <Typography>NCW file will be permanently removed.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDeleteNcwOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleDeleteNcw}
                        color="error"
                        variant="contained"
                        disabled={deletingNcw}
                        startIcon={deletingNcw ? <CircularProgress size={20} color="inherit" /> : null}
                    >
                        {deletingNcw ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>


            <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>

            <TaskForm
                open={isEditFormOpen}
                task={task}
                onClose={() => setIsEditFormOpen(false)}
                onSubmit={async (formData) => {
                    try {
                        const response = await fetch(`/api/tasks/${taskId}`, {
                            method: 'PATCH',
                            body: formData,
                        });
                        const data = (await response.json().catch(() => ({}))) as { task?: Task; error?: string };
                        if (!response.ok || !data.task) {
                            setSnackbarMessage(data.error || 'Failed to update task');
                            setSnackbarSeverity('error');
                            setSnackbarOpen(true);
                            return;
                        }
                        setTask(data.task);
                        setSnackbarMessage('Task updated successfully!');
                        setSnackbarSeverity('success');
                        setSnackbarOpen(true);
                    } catch (_err) {
                        console.error('Error updating task:', _err);
                        setSnackbarMessage('Failed to update task');
                        setSnackbarSeverity('error');
                        setSnackbarOpen(true);
                    } finally {
                        setIsEditFormOpen(false);
                    }
                }}
            />
        </Box>
    );
}

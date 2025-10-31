// src/app/org/[org]/projects/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Paper,
    TextField,
    Typography,
    Alert,
    IconButton,
    Snackbar,
    Stack,
    CircularProgress,
    Tooltip,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useRouter, useParams } from 'next/navigation';

type Project = {
    _id: string;
    name: string;
    key: string;
    description?: string;
    // ожидаем, что бэкенд начнет отдавать менеджеров
    managers?: string[];          // первый элемент — текущий менеджер
    managerEmail?: string;        // на случай, если поле одно
};

type GetProjectsSuccess = { projects: Project[] };
type ApiError = { error: string };

export default function OrgProjectsPage() {
    const router = useRouter();

    // получаем slug из URL
    const params = useParams() as { org: string | string[] };
    const orgSlug = Array.isArray(params.org) ? params.org[0] : params.org;

    const [orgName, setOrgName] = useState<string>(orgSlug); // показываем slug, пока не загрузим имя
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // Create dialog
    const [openCreate, setOpenCreate] = useState(false);
    const [name, setName] = useState('');
    const [key, setKey] = useState('');
    const [description, setDescription] = useState('');

    // Edit dialog
    const [openEdit, setOpenEdit] = useState(false);
    const [editProjectId, setEditProjectId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editKey, setEditKey] = useState('');
    const [editDescription, setEditDescription] = useState('');

    // Delete confirm
    const [openDelete, setOpenDelete] = useState(false);
    const [deleteProject, setDeleteProject] = useState<Project | null>(null);

    // Snackbars
    const [snackOpen, setSnackOpen] = useState(false);
    const [snackMsg, setSnackMsg] = useState('');
    const [snackSeverity, setSnackSeverity] = useState<'success' | 'error'>('success');

    const showSnack = (message: string, severity: 'success' | 'error') => {
        setSnackMsg(message);
        setSnackSeverity(severity);
        setSnackOpen(true);
    };

    // загрузка имени организации (fallback — slug)
    const loadOrgName = useCallback(async () => {
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}`);
            const data: { org?: { name?: string } } | ApiError = await res.json();
            if (res.ok && 'org' in data && data.org?.name) {
                setOrgName(data.org.name);
            } else {
                setOrgName(orgSlug);
            }
        } catch {
            setOrgName(orgSlug);
        }
    }, [orgSlug]);

    const loadProjects = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/projects`);
            const data: GetProjectsSuccess | ApiError = await res.json();

            if (!res.ok || !('projects' in data)) {
                setErr('error' in data ? data.error : 'Ошибка загрузки проектов');
                return;
            }

            setProjects(data.projects ?? []);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сети';
            setErr(msg);
        } finally {
            setLoading(false);
        }
    }, [orgSlug]);

    useEffect(() => {
        void loadOrgName();
        void loadProjects();
    }, [loadOrgName, loadProjects]);

    // Create
    const handleCreate = async (): Promise<void> => {
        setErr(null);
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, key, description }),
            });
            const data: { ok: true; project: Project } | ApiError = await res.json();

            if (!res.ok || !('ok' in data) || !data.ok) {
                const msg = 'error' in data ? data.error : 'Ошибка создания проекта';
                setErr(msg);
                showSnack(msg, 'error');
                return;
            }

            setOpenCreate(false);
            setName('');
            setKey('');
            setDescription('');
            showSnack('Проект создан', 'success');
            void loadProjects();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сети';
            setErr(msg);
            showSnack(msg, 'error');
        }
    };

    // Edit
    const openEditDialog = (p: Project) => {
        setEditProjectId(p._id);
        setEditName(p.name);
        setEditKey(p.key);
        setEditDescription(p.description ?? '');
        setOpenEdit(true);
    };

    const handleEditSave = async (): Promise<void> => {
        if (!editProjectId) return;
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/projects/${editProjectId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName, key: editKey, description: editDescription }),
            });
            const data: { ok: true; project: Project } | ApiError = await res.json();

            if (!res.ok || !('ok' in data) || !data.ok) {
                const msg = 'error' in data ? data.error : 'Ошибка обновления проекта';
                setErr(msg);
                showSnack(msg, 'error');
                return;
            }

            setOpenEdit(false);
            setEditProjectId(null);
            showSnack('Проект обновлён', 'success');
            void loadProjects();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сети';
            setErr(msg);
            showSnack(msg, 'error');
        }
    };

    // Delete
    const askDelete = (p: Project) => {
        setDeleteProject(p);
        setOpenDelete(true);
    };

    const handleDeleteConfirm = async (): Promise<void> => {
        if (!deleteProject) return;
        try {
            const res = await fetch(`/api/org/${encodeURIComponent(orgSlug)}/projects/${deleteProject._id}`, {
                method: 'DELETE',
            });
            const data: { ok: true } | ApiError = await res.json();

            if (!res.ok || !('ok' in data) || !data.ok) {
                const msg = 'error' in data ? data.error : 'Ошибка удаления проекта';
                setErr(msg);
                showSnack(msg, 'error');
                return;
            }

            setOpenDelete(false);
            setDeleteProject(null);
            showSnack('Проект удалён', 'success');
            void loadProjects();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Ошибка сети';
            setErr(msg);
            showSnack(msg, 'error');
        }
    };

    const handleCardClick = (projectId: string) => {
        router.push(`/org/${encodeURIComponent(orgSlug)}/projects/${projectId}/tasks`);
    };

    const isCreateDisabled = useMemo(() => !name || !key, [name, key]);
    const isEditDisabled = useMemo(() => !editName || !editKey, [editName, editKey]);

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h5" fontWeight={700}>
                    Проекты / {orgName}
                </Typography>
                <Button variant="contained" onClick={() => setOpenCreate(true)}>
                    Новый проект
                </Button>
            </Box>

            {err && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {err}
                </Alert>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Grid container spacing={2}>
                    {projects.map((p) => {
                        const manager =
                            p.managerEmail ??
                            (Array.isArray(p.managers) && p.managers.length > 0 ? p.managers[0] : '—');

                        return (
                            <Grid key={p._id} item xs={12} md={6} lg={4}>
                                <Paper
                                    sx={{
                                        p: 2,
                                        position: 'relative',
                                        cursor: 'pointer',
                                        transition: 'transform 0.08s ease',
                                        '&:hover': { transform: 'translateY(-2px)' },
                                    }}
                                    onClick={() => handleCardClick(p._id)}
                                    role="button"
                                    aria-label={`Открыть задачи проекта ${p.name}`}
                                    elevation={2}
                                >
                                    {/* Action icons */}
                                    <Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 8, right: 8 }}>
                                        <Tooltip title="Редактировать">
                                        <IconButton
                                            size="small"
                                            aria-label="Редактировать"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                openEditDialog(p);
                                            }}
                                        >
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Удалить">
                                        <IconButton
                                            size="small"
                                            aria-label="Удалить"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                askDelete(p);
                                            }}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton></Tooltip>
                                    </Stack>

                                    <Typography variant="subtitle2" color="text.secondary">
                                        {p.key}
                                    </Typography>
                                    <Typography variant="h6" fontWeight={700}>
                                        {p.name}
                                    </Typography>

                                    {p.description && (
                                        <Typography variant="body2" sx={{ mt: 1 }}>
                                            {p.description}
                                        </Typography>
                                    )}

                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="body2" color="text.secondary">
                                            Менеджер: <strong>{manager}</strong>
                                        </Typography>
                                    </Box>
                                </Paper>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {/* Create */}
            <Dialog open={openCreate} onClose={() => setOpenCreate(false)}>
                <DialogTitle>Новый проект</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <TextField
                        label="Название"
                        fullWidth
                        sx={{ mt: 1 }}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <TextField
                        label="Код (KEY)"
                        fullWidth
                        sx={{ mt: 2 }}
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                    />
                    <TextField
                        label="Описание"
                        fullWidth
                        multiline
                        minRows={3}
                        sx={{ mt: 2 }}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreate(false)}>Отмена</Button>
                    <Button onClick={handleCreate} variant="contained" disabled={isCreateDisabled}>
                        Создать
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Edit */}
            <Dialog open={openEdit} onClose={() => setOpenEdit(false)}>
                <DialogTitle>Редактировать проект</DialogTitle>
                <DialogContent sx={{ pt: 1 }}>
                    <TextField
                        label="Название"
                        fullWidth
                        sx={{ mt: 1 }}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                    />
                    <TextField
                        label="Код (KEY)"
                        fullWidth
                        sx={{ mt: 2 }}
                        value={editKey}
                        onChange={(e) => setEditKey(e.target.value)}
                    />
                    <TextField
                        label="Описание"
                        fullWidth
                        multiline
                        minRows={3}
                        sx={{ mt: 2 }}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenEdit(false)}>Отмена</Button>
                    <Button onClick={handleEditSave} variant="contained" disabled={isEditDisabled}>
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete confirm */}
            <Dialog open={openDelete} onClose={() => setOpenDelete(false)}>
                <DialogTitle>Удалить проект?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Это действие нельзя отменить. Удалить проект <strong>{deleteProject?.name}</strong>?
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDelete(false)}>Отмена</Button>
                    <Button color="error" variant="contained" onClick={handleDeleteConfirm}>
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar (нижний левый угол) */}
            <Snackbar
                open={snackOpen}
                autoHideDuration={4000}
                onClose={() => setSnackOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
                <Alert onClose={() => setSnackOpen(false)} severity={snackSeverity} variant="filled" sx={{ width: '100%' }}>
                    {snackMsg}
                </Alert>
            </Snackbar>
        </Box>
    );
}

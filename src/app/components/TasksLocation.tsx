'use client';

import * as React from 'react';
import { Box, CircularProgress, Alert, Typography, Paper, Stack } from '@mui/material';
import { YMaps, Map, Placemark, Clusterer, ZoomControl, FullscreenControl } from '@pbe/react-yandex-maps';
import { fetchUserContext } from '@/app/utils/userContext';

type TaskLocation = {
    _id?: string;
    taskId?: string;
    taskName?: string;
    bsNumber?: string;
    bsLocation?: Array<{ name?: string; coordinates?: string | null }>;
    executorId?: string | null;
    executorEmail?: string | null;
};

type MapPoint = {
    id: string;
    coords: [number, number];
    bsNumber: string;
    taskId: string;
    taskName: string;
    relatedNumbers: string | null;
    slug: string | null;
};

type UserIdentity = {
    id?: string;
    email?: string;
};

const DEFAULT_CENTER: [number, number] = [56.0, 104.0];

const parseCoords = (raw?: string | null): [number, number] | null => {
    if (!raw) return null;
    const parts = raw
        .trim()
        .split(/[ ,;]+/)
        .map((part) => Number(part))
        .filter((value) => Number.isFinite(value));
    if (parts.length < 2) return null;
    return [parts[0], parts[1]];
};

const normalizeSlug = (task: TaskLocation): string | null => {
    if (typeof task.taskId === 'string' && task.taskId.trim()) {
        return task.taskId.trim().toLowerCase();
    }
    if (typeof task._id === 'string' && task._id.trim()) {
        return task._id.trim();
    }
    return null;
};

const collectBsNumbers = (task: TaskLocation): string[] => {
    const names = Array.isArray(task.bsLocation)
        ? task.bsLocation
              .map((loc) => (loc?.name ? loc.name.trim() : ''))
              .filter(Boolean)
        : [];
    if (names.length > 0) return names;
    if (typeof task.bsNumber !== 'string') return [];
    return task.bsNumber
        .split(/[-;,]+/)
        .map((value) => value.trim())
        .filter(Boolean);
};

const buildRelatedNumbers = (task: TaskLocation, pool: string[], currentIndex: number): string | null => {
    if (!Array.isArray(task.bsLocation) || task.bsLocation.length < 2) return null;
    const values: string[] = [];
    task.bsLocation.forEach((loc, idx) => {
        if (idx === currentIndex) return;
        const number = (loc?.name && loc.name.trim()) || pool[idx] || pool[0];
        if (number) {
            values.push(number);
        }
    });
    if (values.length === 0) return null;
    return values.join(', ');
};

export default function TasksLocation(): React.ReactElement {
    const [tasks, setTasks] = React.useState<TaskLocation[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [userIdentity, setUserIdentity] = React.useState<UserIdentity | null>(null);

    React.useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const [ctx, tasksResponse] = await Promise.all([
                    fetchUserContext(),
                    fetch('/api/tasks', { cache: 'no-store' }),
                ]);
                if (!active) return;

                if (ctx?.user) {
                    const emailFromPayload = typeof ctx.email === 'string' ? ctx.email : undefined;
                    const rawUser = ctx.user as { email?: unknown; clerkUserId?: unknown };
                    const userEmail =
                        typeof rawUser?.email === 'string'
                            ? rawUser.email
                            : emailFromPayload;
                    const email = userEmail ? userEmail.toLowerCase() : undefined;
                    const clerkId = typeof rawUser?.clerkUserId === 'string' ? rawUser.clerkUserId : undefined;
                    setUserIdentity({
                        id: clerkId,
                        email,
                    });
                } else {
                    setError('Не удалось определить текущего пользователя');
                }

                const payload = (await tasksResponse.json()) as { tasks?: TaskLocation[]; error?: string };
                if (!tasksResponse.ok) {
                    setError(payload?.error ?? 'Не удалось загрузить задачи');
                    return;
                }
                setTasks(Array.isArray(payload.tasks) ? payload.tasks : []);
            } catch (err) {
                if (!active) return;
                setError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            active = false;
        };
    }, []);

    const assignedTasks = React.useMemo(() => {
        const executorId = userIdentity?.id;
        const email = userIdentity?.email;
        if (!executorId && !email) return [];
        return tasks.filter((task) => {
            const taskEmail =
                typeof task.executorEmail === 'string' ? task.executorEmail.toLowerCase() : '';
            return Boolean(
                (executorId && task.executorId === executorId) ||
                    (email && taskEmail === email)
            );
        });
    }, [tasks, userIdentity]);

    const placemarks = React.useMemo(() => {
        const result: MapPoint[] = [];
        for (const task of assignedTasks) {
            if (!Array.isArray(task.bsLocation) || task.bsLocation.length === 0) continue;
            const bsNumbers = collectBsNumbers(task);
            task.bsLocation.forEach((loc, idx) => {
                const coords = parseCoords(loc?.coordinates);
                if (!coords) return;

                const bsNumber =
                    (loc?.name && loc.name.trim()) || bsNumbers[idx] || bsNumbers[0] || task.bsNumber || `БС ${idx + 1}`;
                const relatedNumbers = buildRelatedNumbers(task, bsNumbers, idx);

                result.push({
                    id: `${task._id ?? task.taskId ?? 'task'}-${idx}`,
                    coords,
                    bsNumber,
                    taskId: task.taskId ?? task._id ?? '',
                    taskName: task.taskName?.trim() || 'Задача',
                    relatedNumbers,
                    slug: normalizeSlug(task),
                });
            });
        }
        return result;
    }, [assignedTasks]);

    const mapCenter = React.useMemo<[number, number]>(() => {
        if (!placemarks.length) return DEFAULT_CENTER;
        const sums = placemarks.reduce(
            (acc, point) => {
                acc.lat += point.coords[0];
                acc.lon += point.coords[1];
                return acc;
            },
            { lat: 0, lon: 0 }
        );
        return [sums.lat / placemarks.length, sums.lon / placemarks.length];
    }, [placemarks]);

    const zoom = React.useMemo(() => {
        if (!placemarks.length) return 4;
        return placemarks.length > 1 ? 5 : 12;
    }, [placemarks.length]);

    const ymapsQuery = React.useMemo(() => {
        const apiKey =
            process.env.NEXT_PUBLIC_YANDEX_MAPS_APIKEY ?? process.env.NEXT_PUBLIC_YMAPS_API_KEY;
        const base = { lang: 'ru_RU' as const };
        return apiKey ? { ...base, apikey: apiKey } : base;
    }, []);

    const mapKey = `${mapCenter[0].toFixed(4)}-${mapCenter[1].toFixed(4)}-${placemarks.length}`;
    const showEmptyState = !loading && !error && placemarks.length === 0;

    const buildBalloonContent = React.useCallback((point: MapPoint) => {
        const linkHref = point.slug ? `/tasks/${encodeURIComponent(point.slug)}` : null;
        const relatedBlock = point.relatedNumbers
            ? `<div style="margin-bottom:4px;">Связанные БС: ${point.relatedNumbers}</div>`
            : '';
        return `<div style="font-family:Inter,Arial,sans-serif;min-width:240px;">
            <div style="font-weight:600;margin-bottom:4px;">БС ${point.bsNumber}</div>
            <div style="margin-bottom:4px;">ID задачи: ${point.taskId || '—'}</div>
            <div style="margin-bottom:4px;">${point.taskName || '—'}</div>
            ${relatedBlock}
            ${
                linkHref
                    ? `<a href="${linkHref}" style="color:#1976d2;text-decoration:none;font-weight:600;" target="_self">Перейти к задаче</a>`
                    : ''
            }
        </div>`;
    }, []);

    return (
        <Box
            sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                minHeight: '70vh',
                overflow: 'hidden',
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    zIndex: 5,
                    width: { xs: 'calc(100% - 32px)', sm: 360 },
                    pointerEvents: 'none',
                }}
            >
                <Paper sx={{ p: 2, boxShadow: 3, pointerEvents: 'auto' }}>
                    <Stack spacing={0.5}>
                        <Typography variant="h6" fontWeight={700}>
                            Мои задачи на карте
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Показаны только базовые станции из задач, назначенных вам. Нажмите на маркер, чтобы
                            открыть карточку задачи.
                        </Typography>
                        <Typography variant="body2" fontWeight={600}>
                            Точек на карте: {placemarks.length}
                        </Typography>
                    </Stack>
                </Paper>
                {showEmptyState && (
                    <Alert severity="info" sx={{ mt: 1.5 }}>
                        Нет задач с координатами, назначенных вам.
                    </Alert>
                )}
                {error && (
                    <Alert severity="error" sx={{ mt: 1.5 }}>
                        {error}
                    </Alert>
                )}
            </Box>

            <Box sx={{ width: '100%', height: '100%' }}>
                {loading ? (
                    <Box
                        sx={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <CircularProgress />
                    </Box>
                ) : error || placemarks.length === 0 ? null : (
                    <YMaps query={ymapsQuery}>
                        <Map
                            key={mapKey}
                            defaultState={{ center: mapCenter, zoom }}
                            width="100%"
                            height="100%"
                            options={{
                                suppressObsoleteBrowserNotifier: true,
                                suppressMapOpenBlock: true,
                            }}
                        >
                            <FullscreenControl options={{ position: { right: 16, top: 16 } }} />
                            <ZoomControl options={{ position: { right: 16, top: 80 } }} />
                            <Clusterer
                                options={{
                                    preset: 'islands#blueClusterIcons',
                                    groupByCoordinates: false,
                                    gridSize: 80,
                                }}
                            >
                                {placemarks.map((point) => (
                                    <Placemark
                                        key={point.id}
                                        geometry={point.coords}
                                        properties={{
                                            hintContent: `БС ${point.bsNumber}`,
                                            balloonContent: buildBalloonContent(point),
                                            iconCaption: point.bsNumber,
                                        }}
                                        options={{
                                            preset: 'islands#blueCircleDotIcon',
                                            hideIconOnBalloonOpen: false,
                                        }}
                                        modules={['geoObject.addon.balloon', 'geoObject.addon.hint']}
                                    />
                                ))}
                            </Clusterer>
                        </Map>
                    </YMaps>
                )}
            </Box>
        </Box>
    );
}

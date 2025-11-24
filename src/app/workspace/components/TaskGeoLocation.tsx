// src/app/workspace/components/TaskGeoLocation.tsx
'use client';

import * as React from 'react';
import {
    Box,
    Typography,
    Stack,
    Divider,
    Dialog,
    AppBar,
    Toolbar,
    IconButton,
} from '@mui/material';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import CloseIcon from '@mui/icons-material/Close';
import {
    YMaps,
    Map,
    Placemark,
    FullscreenControl,
    TypeSelector,
    ZoomControl,
    GeolocationControl,
    SearchControl,
} from '@pbe/react-yandex-maps';

export type TaskGeoLocationProps = {
    locations?: Array<{
        name?: string;
        coordinates: string;
    }>;
};

const parseCoords = (s?: string): [number, number] | null => {
    if (!s) return null;
    const parts = s.trim().split(/[ ,;]+/).map(Number).filter((n) => !Number.isNaN(n));
    if (parts.length >= 2) return [parts[0], parts[1]] as [number, number];
    return null;
};

export default function TaskGeoLocation({ locations = [] }: TaskGeoLocationProps) {
    const [mapOpen, setMapOpen] = React.useState(false);
    const [selectedPoint, setSelectedPoint] = React.useState<{
        coords: [number, number];
        title: string;
    } | null>(null);
    const [activeLocationMeta, setActiveLocationMeta] = React.useState<{
        name?: string;
        coordinates: string;
    } | null>(null);

    const handleOpen = (loc: { name?: string; coordinates: string }, idx: number) => {
        const coords = parseCoords(loc.coordinates);
        if (!coords) return;
        setSelectedPoint({
            coords,
            title: loc.name || `Точка ${idx + 1}`,
        });
        setActiveLocationMeta(loc);
        setMapOpen(true);
    };

    const buildBalloonContent = (loc: { name?: string; coordinates: string }) => {
        const coords = parseCoords(loc.coordinates);
        const coordString =
            coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])
                ? `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`
                : loc.coordinates;

        const title = loc.name || 'Точка';
        const routeUrl =
            coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])
                ? `https://yandex.ru/maps/?rtext=~${coords[0]},${coords[1]}&rtt=auto`
                : null;
        const iconSvg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.53 5H6.47c-.63 0-1.18.42-1.39 1.01L3 11v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h10v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-4.99zM6.85 7h10.29l1.04 2.5H5.81L6.85 7zM19 15H5v-3h14v3zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5S15.67 14 16.5 14s1.5.67 1.5 1.5S17.33 17 16.5 17z"/></svg>';
        return `<div style="font-family:Inter,Arial,sans-serif;min-width:220px;max-width:260px;">
            <div style="font-weight:600;margin-bottom:6px;">${title}</div>
            <div style="margin-bottom:4px;">Координаты: ${coordString || '—'}</div>
            ${
                routeUrl
                    ? `<a href="${routeUrl}" target="_blank" rel="noreferrer" style="display:inline-flex;align-items:center;gap:6px;color:#1976d2;text-decoration:none;font-weight:600;margin-top:6px;">Маршрут ${iconSvg}</a>`
                    : ''
            }
        </div>`;
    };

    const mapState = selectedPoint
        ? {
              center: selectedPoint.coords,
              zoom: 14,
              type: 'yandex#hybrid' as const,
              controls: [] as string[],
          }
        : {
              center: [55.751244, 37.618423] as [number, number],
              zoom: 4,
              type: 'yandex#map' as const,
              controls: [] as string[],
          };

    return (
        <>
            <Typography
                variant="subtitle1"
                fontWeight={600}
                gutterBottom
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
                <LocationOnOutlinedIcon fontSize="small" />
                Геолокация
            </Typography>
            <Divider sx={{ mb: 1.5 }} />

            {locations.length > 0 ? (
                <Stack gap={1}>
                    {locations.map((loc, idx) => (
                        <Box key={idx}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {loc.name || `Точка ${idx + 1}`}
                            </Typography>
                            <Typography
                                variant="body2"
                                color="primary"
                                sx={{ cursor: 'pointer' }}
                                onClick={() => handleOpen(loc, idx)}
                            >
                                {loc.coordinates}
                            </Typography>
                        </Box>
                    ))}
                </Stack>
            ) : (
                <Typography color="text.secondary" variant="body2">
                    Геоданных нет
                </Typography>
            )}

            <Dialog fullScreen open={mapOpen} onClose={() => setMapOpen(false)}>
                <AppBar sx={{ position: 'relative' }}>
                    <Toolbar>
                        <IconButton edge="start" color="inherit" onClick={() => setMapOpen(false)} aria-label="close">
                            <CloseIcon />
                        </IconButton>
                        <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
                            {selectedPoint?.title ?? 'Карта'}
                        </Typography>
                    </Toolbar>
                </AppBar>
                <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
                    <YMaps query={{ apikey: '1c3860d8-3994-4e6e-841b-31ad57f69c78', lang: 'ru_RU' }}>
                        <Map
                            state={mapState}
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
                            <ZoomControl />
                            <TypeSelector />
                            <GeolocationControl />
                            <SearchControl />
                            {selectedPoint && (
                                <Placemark
                                    geometry={selectedPoint.coords}
                                    properties={{
                                        balloonContent: buildBalloonContent(
                                            activeLocationMeta || {
                                                name: selectedPoint.title,
                                                coordinates: selectedPoint.coords.join(', '),
                                            }
                                        ),
                                        hintContent: selectedPoint.title,
                                        iconCaption: selectedPoint.title,
                                    }}
                                    options={{
                                        preset: 'islands#redIcon',
                                        iconColor: '#ef4444',
                                        hideIconOnBalloonOpen: false,
                                    }}
                                    modules={['geoObject.addon.balloon', 'geoObject.addon.hint']}
                                />
                            )}
                            <FullscreenControl />
                        </Map>
                    </YMaps>
                </Box>
            </Dialog>
        </>
    );
}

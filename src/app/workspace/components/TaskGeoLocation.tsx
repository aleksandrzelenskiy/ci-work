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
        return `<div style="font-family:Inter,Arial,sans-serif;min-width:220px;max-width:260px;">
            <div style="font-weight:600;margin-bottom:6px;">${title}</div>
            <div style="margin-bottom:4px;">Координаты: ${coordString || '—'}</div>
            <div style="color:#6b7280;font-size:12px;">(добавьте описание для этой точки при необходимости)</div>
        </div>`;
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
                <Box sx={{ height: '100%', width: '100%' }}>
                    <YMaps query={{ apikey: '1c3860d8-3994-4e6e-841b-31ad57f69c78', lang: 'ru_RU' }}>
                        <Map
                            state={
                                selectedPoint
                                    ? { center: selectedPoint.coords, zoom: 14, type: 'yandex#hybrid' }
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

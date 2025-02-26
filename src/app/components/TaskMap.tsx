'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  YMaps,
  Map,
  Placemark,
  Clusterer,
  FullscreenControl,
} from '@pbe/react-yandex-maps';
import { Box, CircularProgress, Typography, TextField } from '@mui/material';
import { Task, BsLocation } from '@/app/types/taskTypes';
import { v4 as uuidv4 } from 'uuid';

const TARGET_COORDINATES = [52.28685807408046, 104.28861941586536];

const calculateDistance = (lat1: number, lon1: number) => {
  const [lat2, lon2] = TARGET_COORDINATES;
  const R = 6371; // Радиус Земли в км
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const TaskMap = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [distances, setDistances] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch('/api/tasks');
        const data = await response.json();

        if (!response.ok)
          throw new Error(data.error || 'Failed to fetch tasks');

        setTasks(data.tasks);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  // Группировка задач по координатам с мемоизацией
  const groupedTasks = useMemo(() => {
    return tasks.reduce((acc, task) => {
      task.bsLocation.forEach((location: BsLocation) => {
        const key = location.coordinates;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push({ ...task, location });
      });
      return acc;
    }, {} as Record<string, Array<Task & { location: BsLocation }>>);
  }, [tasks]);

  //Рассчет расстояний
  const calculatedDistances = useMemo(() => {
    const result: Record<string, number> = {};

    Object.keys(groupedTasks).forEach((coords) => {
      const [lat, lon] = coords.split(' ').map(Number);
      result[coords] = calculateDistance(lat, lon);
    });

    return result;
  }, [groupedTasks]);

  // Обновляем состояние при изменении
  useEffect(() => {
    setDistances(calculatedDistances);
  }, [calculatedDistances]);

  // Фильтрация задач по поисковому запросу
  const filteredGroupedTasks = useMemo(() => {
    if (!searchQuery.trim()) return Object.entries(groupedTasks);
    const query = searchQuery.toLowerCase().trim();
    return Object.entries(groupedTasks).filter(([, tasks]) => {
      return tasks.some((task) =>
        task.location.name.toLowerCase().includes(query)
      );
    });
  }, [groupedTasks, searchQuery]);

  if (loading) {
    return (
      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        height='300px'
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Typography color='error' className='text-center mt-4'>
        {error}
      </Typography>
    );
  }

  return (
    <Box sx={{ position: 'relative', height: '100%', width: '100%' }}>
      <YMaps query={{ apikey: process.env.NEXT_PUBLIC_YANDEX_MAPS_APIKEY }}>
        <Map
          defaultState={{
            center: [54.51086463889672, 102.94017700007622],
            zoom: 5,
          }}
          width='100%'
          height='100%'
        >
          <Clusterer
            options={{
              preset: 'islands#invertedBlueClusterIcons',
              groupByCoordinates: false,
              clusterDisableClickZoom: true,
              clusterOpenBalloonOnClick: true,
            }}
          >
            {filteredGroupedTasks.map(([coordinates, tasks]) => {
              const [lat, lon] = coordinates.split(' ').map(Number);
              return (
                <Placemark
                  key={uuidv4()}
                  geometry={[lat, lon]}
                  properties={{
                    balloonContent: tasks
                      .map(
                        (task) => `
                         <b>Distance:</b> ${distances[coordinates]?.toFixed(
                           1
                         )} km<br/>
                        <b>${task.taskName}</b><br/>
                        <b>Task ID:</b> ${task.taskId}<br/>
                        <b>BS:</b> ${task.location.name}<br/>
                       
                        <a href="/tasks/${task.taskId.toLowerCase()}">View Details</a><br/><br/>
                      `
                      )
                      .join(''),
                  }}
                  options={{
                    preset: 'islands#blueCircleDotIcon',
                    iconColor: '#1e88e5',
                    balloonCloseButton: true,
                    hideIconOnBalloonOpen: false,
                  }}
                  modules={['geoObject.addon.balloon']}
                />
              );
            })}
          </Clusterer>
          <FullscreenControl />
        </Map>
      </YMaps>

      {/* Поле поиска */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 1000,
          width: '300px',
          backgroundColor: 'background.paper',
          boxShadow: 1,
          p: 1,
        }}
      >
        <TextField
          fullWidth
          size='small'
          label='Search by BS number'
          variant='outlined'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder='Enter BS number...'
        />
      </Box>

      {/* Сообщение об отсутствии результатов */}
      {filteredGroupedTasks.length === 0 && searchQuery && (
        <Box
          sx={{
            position: 'absolute',
            top: 80,
            left: 16,
            zIndex: 1000,
            backgroundColor: 'background.paper',
            p: 2,
            borderRadius: 1,
            boxShadow: 1,
          }}
        >
          <Typography variant='body1' color='textSecondary'>
            No stations found
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default TaskMap;

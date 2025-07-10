// app/components/TaskMap.tsx

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  YMaps,
  Map,
  Placemark,
  Clusterer,
  FullscreenControl,
  TypeSelector,
} from '@pbe/react-yandex-maps';
import {
  Box,
  CircularProgress,
  Typography,
  IconButton,
  Drawer,
  TextField,
  FormControlLabel,
  Checkbox,
  List,
  ListItem,
  Divider,
  AppBar,
  Toolbar,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import RemoveIcon from '@mui/icons-material/Remove';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';

import {
  Task,
  BsLocation,
  CurrentStatus,
  PriorityLevel,
} from '@/app/types/taskTypes';
import { v4 as uuidv4 } from 'uuid';
import { getStatusColor } from '@/utils/statusColors';

// Все статусы и приоритеты
const ALL_STATUSES: CurrentStatus[] = [
  'To do',
  'Assigned',
  'At work',
  'Done',
  'Pending',
  'Issues',
  'Fixed',
  'Agreed',
];

const ALL_PRIORITIES: PriorityLevel[] = ['urgent', 'high', 'medium', 'low'];

// Функция для вывода приоритета в виде HTML-иконки (используется в балуне)
function getPriorityIconHTML(priority: PriorityLevel): string {
  // можно при желании убрать, если не нужны иконки приоритета в балуне
  const getPriorityColor = (p: PriorityLevel) => {
    switch (p) {
      case 'low':
        return '#28a0e9';
      case 'medium':
        return '#df9b18';
      case 'high':
        return '#ca3131';
      case 'urgent':
        return '#ff0000';
      default:
        return '#28a0e9';
    }
  };

  const color = getPriorityColor(priority);
  let icon = '';
  switch (priority) {
    case 'low':
      icon = '●';
      break;
    case 'medium':
      icon = '⦿';
      break;
    case 'high':
      icon = '▲';
      break;
    case 'urgent':
      icon = '⯅';
      break;
    default:
      icon = '●';
  }
  return `<span style="color:${color}; font-weight:bold; margin-right:4px;">${icon}</span>`;
}

// Координаты для вычисления расстояния
const TARGET_COORDINATES = [52.28685807408046, 104.28861941586536];

// Функция расчёта дистанции
const calculateDistance = (lat1: number, lon1: number) => {
  const [lat2, lon2] = TARGET_COORDINATES;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function TaskMap() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drawer и поле поиска
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Фильтр статусов, по умолчанию все выбраны
  const [statusFilter, setStatusFilter] = useState<
    Record<CurrentStatus, boolean>
  >(
    ALL_STATUSES.reduce((acc, status) => {
      acc[status] = status !== 'Agreed';
      return acc;
    }, {} as Record<CurrentStatus, boolean>)
  );

  // Фильтр приоритетов, по умолчанию все выбраны
  const [priorityFilter, setPriorityFilter] = useState<
    Record<PriorityLevel, boolean>
  >(
    ALL_PRIORITIES.reduce((acc, prio) => {
      acc[prio] = true;
      return acc;
    }, {} as Record<PriorityLevel, boolean>)
  );

  // Фильтр исполнителя
  const [executorFilter, setExecutorFilter] = useState('');

  // Словарь расстояний
  const [distances, setDistances] = useState<Record<string, number>>({});

  // Сброс всех фильтров
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter(
      ALL_STATUSES.reduce((acc, status) => {
        acc[status] = status ! == 'Agreed';
        return acc;
      }, {} as Record<CurrentStatus, boolean>)
    );
    setPriorityFilter(
      ALL_PRIORITIES.reduce((acc, prio) => {
        acc[prio] = true;
        return acc;
      }, {} as Record<PriorityLevel, boolean>)
    );
    setExecutorFilter('');
  };

  // Кнопки "Clear All" / "Check All" для блока статусов
  const clearAllStatuses = () => {
    setStatusFilter((prev) => {
      const newState = { ...prev };
      ALL_STATUSES.forEach((st) => {
        newState[st] = false;
      });
      return newState;
    });
  };
  const checkAllStatuses = () => {
    setStatusFilter((prev) => {
      const newState = { ...prev };
      ALL_STATUSES.forEach((st) => {
        newState[st] = true;
      });
      return newState;
    });
  };

  // Кнопки "Clear All" / "Check All" для блока приоритетов
  const clearAllPriorities = () => {
    setPriorityFilter((prev) => {
      const newState = { ...prev };
      ALL_PRIORITIES.forEach((pr) => {
        newState[pr] = false;
      });
      return newState;
    });
  };
  const checkAllPriorities = () => {
    setPriorityFilter((prev) => {
      const newState = { ...prev };
      ALL_PRIORITIES.forEach((pr) => {
        newState[pr] = true;
      });
      return newState;
    });
  };

  // Загружаем задачи
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch('/api/tasks');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch tasks');
        }
        setTasks(data.tasks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  // Группируем задачи по координатам
  const groupedTasks = useMemo(() => {
    return tasks.reduce((acc, task) => {
      task.bsLocation.forEach((loc: BsLocation) => {
        const key = loc.coordinates;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push({ ...task, location: loc });
      });
      return acc;
    }, {} as Record<string, Array<Task & { location: BsLocation }>>);
  }, [tasks]);

  // Список уникальных исполнителей
  const uniqueExecutors = useMemo(() => {
    const names = tasks
      .map((t) => t.executorName)
      .filter((val) => Boolean(val) && val.trim() !== '');
    return Array.from(new Set(names));
  }, [tasks]);

  // Вычисляем дистанции
  const calculatedDistances = useMemo(() => {
    const result: Record<string, number> = {};
    Object.keys(groupedTasks).forEach((coords) => {
      const [lat, lon] = coords.split(' ').map(Number);
      result[coords] = calculateDistance(lat, lon);
    });
    return result;
  }, [groupedTasks]);

  useEffect(() => {
    setDistances(calculatedDistances);
  }, [calculatedDistances]);

  // Фильтрация
  const filteredGroupedTasks = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return Object.entries(groupedTasks).filter(([, tasksAtCoord]) =>
      tasksAtCoord.some((t) => {
        const matchSearch = query
          ? t.location.name.toLowerCase().includes(query)
          : true;
        const matchStatus = statusFilter[t.status];
        const matchPriority = priorityFilter[t.priority];
        const matchExecutor = executorFilter
          ? t.executorName === executorFilter
          : true;

        return matchSearch && matchStatus && matchPriority && matchExecutor;
      })
    );
  }, [groupedTasks, searchQuery, statusFilter, priorityFilter, executorFilter]);

  // Проверяем, есть ли отличия от дефолтных фильтров
  const isDefaultFilterState = useMemo(() => {
    if (searchQuery !== '') return false;
    if (executorFilter !== '') return false;
    for (const st of ALL_STATUSES) {
      if (st === 'Agreed') {
        if (statusFilter[st]) return false
      } else {
        if (!statusFilter[st]) return false
      }
    }
    for (const pr of ALL_PRIORITIES) {
      if (!priorityFilter[pr]) return false;
    }
    return true;
  }, [searchQuery, executorFilter, statusFilter, priorityFilter]);

  // Если идёт загрузка
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

  // Если ошибка
  if (error) {
    return (
      <Typography color='error' textAlign='center' mt={4}>
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
            zoom: 6,
          }}
          width='100%'
          height='100%'
        >
          <TypeSelector />
          <FullscreenControl />

          <Clusterer
            options={{
              preset: 'islands#invertedBlueClusterIcons',
              groupByCoordinates: false,
              clusterDisableClickZoom: true,
              clusterOpenBalloonOnClick: true,
            }}
          >
            {filteredGroupedTasks.map(([coords, tasksAtCoord]) => {
              const [lat, lon] = coords.split(' ').map(Number);
              // Формируем контент балуна
              const balloonHtml = tasksAtCoord
                .map((item) => {
                  const priorityIcon = getPriorityIconHTML(item.priority);
                  return `
                    <div style="margin-bottom:6px; line-height:1.2;">
                      <strong>Distance:</strong> ${distances[coords]?.toFixed(
                        1
                      )} km<br/>
                      <strong>Task Name:</strong> ${item.taskName}<br/>
                      <strong>BS:</strong> ${item.location.name}<br/>
                      <strong>Status:</strong> ${item.status}<br/>
                      <strong>Priority:</strong> ${priorityIcon}${
                    item.priority
                  }<br/>
                      <strong>Executor:</strong> ${
                        item.executorName || 'N/A'
                      }<br/>
                      <a href="/tasks/${item.taskId.toLowerCase()}">View Details</a>
                    </div>
                  `;
                })
                .join('');
              return (
                <Placemark
                  key={uuidv4()}
                  geometry={[lat, lon]}
                  properties={{
                    balloonContent: balloonHtml,
                    iconContent: tasksAtCoord[0].location.name,
                  }}
                  options={{
                    preset: 'islands#blueStretchyIcon',
                    balloonCloseButton: true,
                    hideIconOnBalloonOpen: false,
                  }}
                  modules={['geoObject.addon.balloon']}
                />
              );
            })}
          </Clusterer>
        </Map>
      </YMaps>

      {/* Кнопка открытия фильтров */}
      <Box sx={{ position: 'absolute', top: 6, left: 6, zIndex: 1000 }}>
        <IconButton
          onClick={() => setDrawerOpen(true)}
          sx={{ boxShadow: 1, backgroundColor: 'background.paper' }}
          color={isDefaultFilterState ? 'default' : 'primary'}
        >
          <FilterListIcon />
        </IconButton>
      </Box>

      {/* Drawer с фильтрами */}
      <Drawer
        anchor='right'
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <AppBar position='static' sx={{ backgroundColor: '#1976d2' }}>
          <Toolbar variant='dense' sx={{ justifyContent: 'space-between' }}>
            <Typography variant='h6'>Filters</Typography>
            <IconButton
              edge='end'
              color='inherit'
              onClick={() => setDrawerOpen(false)}
            >
              <CloseIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box
          sx={{ width: 300, p: 2 }}
          role='presentation'
          display='flex'
          flexDirection='column'
          gap={2}
        >
          {/* Поиск по BS */}
          <TextField
            size='small'
            label='Search BS'
            variant='outlined'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Enter BS number...'
          />

          <Divider />

          {/* Блок статусов + Clear/Check All */}
          <Box
            display='flex'
            justifyContent='space-between'
            alignItems='center'
          >
            <Typography variant='subtitle1'>Status</Typography>
            <Box display='flex' gap={1}>
              <Button size='small' onClick={clearAllStatuses}>
                Clear All
              </Button>
              <Button size='small' onClick={checkAllStatuses}>
                Check All
              </Button>
            </Box>
          </Box>

          <List dense sx={{ mb: 1 }}>
            {ALL_STATUSES.map((status) => {
              const circleColor = getStatusColor(status);
              return (
                <ListItem key={status}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={statusFilter[status]}
                        onChange={(e) =>
                          setStatusFilter((prev) => ({
                            ...prev,
                            [status]: e.target.checked,
                          }))
                        }
                      />
                    }
                    label={
                      <Box display='flex' alignItems='center' gap={1}>
                        {/* Кругляш цвета статуса */}
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            backgroundColor: circleColor,
                          }}
                        />
                        <Typography>{status}</Typography>
                      </Box>
                    }
                  />
                </ListItem>
              );
            })}
          </List>

          {/* Селектор исполнителя (executor) */}
          <Typography variant='subtitle1'>Executor</Typography>
          <FormControl size='small'>
            <InputLabel>Executor</InputLabel>
            <Select
              value={executorFilter}
              label='Executor'
              onChange={(e) => setExecutorFilter(e.target.value)}
            >
              <MenuItem value=''>All</MenuItem>
              {uniqueExecutors.map((ex) => (
                <MenuItem key={ex} value={ex}>
                  {ex}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider />

          {/* Блок приоритетов + Clear/Check All */}
          <Box
            display='flex'
            justifyContent='space-between'
            alignItems='center'
          >
            <Typography variant='subtitle1'>Priority</Typography>
            <Box display='flex' gap={1}>
              <Button size='small' onClick={clearAllPriorities}>
                Clear All
              </Button>
              <Button size='small' onClick={checkAllPriorities}>
                Check All
              </Button>
            </Box>
          </Box>

          <List dense>
            {ALL_PRIORITIES.map((priority) => {
              let IconElem: React.ReactNode = (
                <RemoveIcon sx={{ color: '#28a0e9' }} />
              );
              if (priority === 'medium')
                IconElem = <DragHandleIcon sx={{ color: '#df9b18' }} />;
              if (priority === 'high')
                IconElem = <KeyboardArrowUpIcon sx={{ color: '#ca3131' }} />;
              if (priority === 'urgent')
                IconElem = (
                  <KeyboardDoubleArrowUpIcon sx={{ color: '#ff0000' }} />
                );

              return (
                <ListItem key={priority}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={priorityFilter[priority]}
                        onChange={(e) =>
                          setPriorityFilter((prev) => ({
                            ...prev,
                            [priority]: e.target.checked,
                          }))
                        }
                      />
                    }
                    label={
                      <Box display='flex' alignItems='center' gap={1}>
                        {IconElem}
                        <Typography>{priority}</Typography>
                      </Box>
                    }
                  />
                </ListItem>
              );
            })}
          </List>

          <Divider sx={{ mt: 1 }} />

          <Box display='flex' justifyContent='space-between' mt={1}>
            <Button variant='outlined' onClick={handleResetFilters}>
              Reset
            </Button>
            <Button variant='contained' onClick={() => setDrawerOpen(false)}>
              Close
            </Button>
          </Box>
        </Box>
      </Drawer>

      {/* Если ничего не найдено */}
      {filteredGroupedTasks.length === 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: 80,
            right: 16,
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
}

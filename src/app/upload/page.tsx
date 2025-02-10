'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  TextField,
  Button,
  Box,
  Grid,
  IconButton,
  LinearProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Checkbox,
  FormControlLabel,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useDropzone } from 'react-dropzone';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

interface UploadedFile {
  id: string;
  file: File;
  preview: string;
  progress: number;
}

export default function UploadPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [baseId, setBaseId] = useState('');
  const [task, setTask] = useState('');
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [fileToDelete, setFileToDelete] = useState<UploadedFile | null>(null);
  const [isCheckboxChecked, setIsCheckboxChecked] = useState(false);
  const [isAccordionExpanded, setIsAccordionExpanded] = useState(true);

  // Сворачиваем аккордеон при изменении состояния чекбокса
  useEffect(() => {
    if (isCheckboxChecked) {
      setIsAccordionExpanded(false);
    }
  }, [isCheckboxChecked]);

  // Перенаправляем на страницу входа, если пользователь не аутентифицирован
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/auth/login');
    }
  }, [isLoaded, isSignedIn, router]);

  const onDrop = (acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      id: `${Date.now()}-${file.name}`,
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
    }));
    setFiles((prevFiles) => [...prevFiles, ...newFiles]);
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  const handleRemoveFile = (id: string) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
  };

  const confirmRemoveFile = (file: UploadedFile) => {
    setFileToDelete(file);
  };

  const handleDeleteConfirmed = () => {
    if (fileToDelete) {
      handleRemoveFile(fileToDelete.id);
    }
    setFileToDelete(null);
  };

  const handleUploadClick = async () => {
    if (!baseId || !task || files.length === 0) {
      alert(
        'Пожалуйста, заполните все поля и выберите изображения для загрузки.'
      );
      return;
    }

    const formData = new FormData();
    formData.append('baseId', baseId);
    formData.append('task', task);

    files.forEach((file) => {
      formData.append('image[]', file.file);
    });

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          setFiles((prevFiles) =>
            prevFiles.map((file) => ({
              ...file,
              progress: progress,
            }))
          );
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          // Парсим ответ и извлекаем сообщение
          const responseData = JSON.parse(xhr.responseText);
          if (responseData.success) {
            alert(responseData.message); // <-- Используем соответствующее сообщение
          } else {
            alert('Загрузка завершена, но в ответе отсутствует "success".');
          }

          // Сбрасываем поля и файлы
          setFiles([]);
          setBaseId('');
          setTask('');
        } else {
          alert('Не удалось загрузить изображения');
        }
      };

      xhr.onerror = () => {
        alert('Произошла ошибка при загрузке изображений.');
      };

      xhr.send(formData);
    } catch (error) {
      console.error('Ошибка загрузки:', error);
      alert('Ошибка при загрузке файлов.');
    }
  };

  // Показываем загрузку, если данные еще не загружены
  if (!isLoaded) {
    return <Typography>Загрузка...</Typography>;
  }

  return (
    <>
      <Box sx={{ flexGrow: 1 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Accordion
              expanded={isAccordionExpanded}
              onChange={(event, isExpanded) =>
                setIsAccordionExpanded(isExpanded)
              }
              defaultExpanded
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls='requirements-content'
                id='requirements-header'
              >
                <Typography variant='h6'>
                  Требования к ФО по монтажу РРЛ
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant='body1'>
                  <li>
                    До начала работ выполнить фотографию общего вида антенной
                    опоры
                  </li>
                  <li>
                    Фотоотчет по монтажу радиорелейного пролета выполняется
                    после полного завершения работ.
                  </li>
                  <li>Фотоотчет должен выполняться в светлое время суток.</li>
                  <li>
                    Фотографии должны иметь размер не менее 1280х720рх и иметь
                    надлежащее для просмотра на десктоп устройствах качество
                    изображения.
                  </li>
                </Typography>
                <Typography variant='h6' sx={{ mt: 2 }} gutterBottom>
                  Содержание фотоотчета
                </Typography>
                <strong>Фотографии АФУ</strong>
                <Typography variant='body1'>
                  <li>
                    Фотографии общего вида установленной антенны на антенной
                    опоре (антенна должна быть видна в кадре полностью, включая
                    крепление к трубостойке)
                  </li>
                  <li>Фотографии крепления трубостойки к антенной опоре</li>
                  <li>
                    Фото маркировки данных о пролете на антенне (указание номера
                    основной и ответной части пролета, азимут направления
                    антенны)
                  </li>
                  <li>
                    Фотография в направлении излучения антенны. На фотографии
                    должно быть видно перспективу в направлении излучения
                    радиорелейной антенны (в сторону ответной части)
                  </li>
                  <li>Фото серийного номера антенны</li>
                  <li>Фото серийного номера радиоблока</li>
                  <li>
                    Фото подключения кабелей к интерфейсам радиоблока
                    (обязательно с наличием маркировки кабеля)
                  </li>
                  <li>
                    Фотографии крепления антенны (должны быть выполнены
                    фотографии всех болтовых соединений крепления антенны, на
                    фотографиях должно быть четко видно наличие всех элементов
                    крепления (болты, гайки, контргайки, шайбы плоские, шайбы
                    пружинные), а также должно быть видно, что соединения
                    достаточно качественно протянуты после монтажа и юстировки)
                  </li>
                  <li>
                    Фотографии заземления радиоблока (с наличием маркировки
                    проводника)
                  </li>
                  <li>Фото укладки и крепления запаса кабеля на АО</li>
                  <li>Фото кабельной трассы снизу вверх</li>
                  <li>
                    Фотографии общего вида АО с установленными антеннами (не
                    менее двух фотографий с двух разных сторон)
                  </li>
                  <li>Фото кабельного ввода в аппаратную снаружи</li>
                </Typography>
                <strong>Фотографии в аппаратной / КШ</strong>
                <Typography variant='body1'>
                  <li>Фотографии общего вида 19’’ стойки “в полный рост”</li>
                  <li>Фотографии IDU укрупненно</li>
                  <li>
                    Фотографии подключения кабелей питания и заземления IDU (в
                    случае монтажа IDU) включая маркировку
                  </li>
                  <li>
                    Фотографии подключения любых проводов к маршрутизаторам или
                    иному существующему сетевому оборудованию включая маркировку
                  </li>
                  <li>Фотографии стойки питания “в полный рост”</li>
                  <li>Фото шины автоматов крупно (полностью)</li>
                  <li>
                    Фото подключения питания монтируемого оборудования на шину
                    “+” и автоматический выключатель “-” включая маркировку
                    (номинал автоматов должен читаться на фотографии)
                  </li>
                  <li>Фото укладки кабельной трассы внутри аппаратной</li>
                  <li>Фото кабельного ввода в аппаратную внутри</li>
                </Typography>
                <Box sx={{ mt: 3, mb: 3 }}>
                  <Alert variant='outlined' severity='info'>
                    Подтвердите соответствие фотоотчета требованиям
                  </Alert>
                </Box>

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isCheckboxChecked}
                      onChange={(e) => setIsCheckboxChecked(e.target.checked)}
                    />
                  }
                  label='Все фотографии выполнены в соответствии с требованиями'
                />
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Рендерим блок Upload Photo только если чекбокс отмечен */}
          {isCheckboxChecked && (
            <Grid item xs={12} md={6}>
              <Paper>
                <Box sx={{ padding: 2 }}>
                  <Typography variant='h5' gutterBottom>
                    Загрузить фото
                  </Typography>

                  <TextField
                    fullWidth
                    label='Задача'
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    margin='normal'
                  />
                  <TextField
                    fullWidth
                    label='ID базы'
                    value={baseId}
                    onChange={(e) => setBaseId(e.target.value)}
                    margin='normal'
                  />
                  <Box sx={{ marginBottom: 3 }}>
                    <Grid container spacing={2}>
                      {files.map((uploadedFile) => (
                        <Grid item xs={6} sm={4} md={3} key={uploadedFile.id}>
                          <Box
                            sx={{ position: 'relative', textAlign: 'center' }}
                          >
                            <img
                              src={uploadedFile.preview}
                              alt={uploadedFile.file.name}
                              style={{
                                width: '100%',
                                height: 'auto',
                                borderRadius: '8px',
                              }}
                            />
                            <IconButton
                              onClick={() => confirmRemoveFile(uploadedFile)}
                              sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                background: 'rgba(255, 255, 255, 0.8)',
                                '&:hover': {
                                  background: 'rgba(255, 255, 255, 1)',
                                },
                              }}
                            >
                              <DeleteIcon />
                            </IconButton>
                            <Typography variant='body2' noWrap>
                              {uploadedFile.file.name}
                            </Typography>
                            <LinearProgress
                              variant='determinate'
                              value={uploadedFile.progress}
                              sx={{ marginTop: 1 }}
                            />
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Box>

                  <Box
                    {...getRootProps()}
                    sx={{
                      border: '2px dashed #ccc',
                      borderRadius: '8px',
                      padding: 2,
                      textAlign: 'center',
                      marginBottom: 2,
                      cursor: 'pointer',
                    }}
                  >
                    <input {...getInputProps()} />
                    <Typography variant='body1'>
                      Перетащите изображения сюда или нажмите для выбора
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginTop: 5,
                    }}
                  >
                    <Button
                      variant='contained'
                      startIcon={<CloudUploadIcon />}
                      color='primary'
                      onClick={handleUploadClick}
                      disabled={!baseId || !task || files.length === 0}
                    >
                      Загрузить фото
                    </Button>
                  </Box>

                  {/* Диалог подтверждения удаления */}
                  <Dialog
                    open={!!fileToDelete}
                    onClose={() => setFileToDelete(null)}
                    aria-labelledby='confirm-delete-title'
                  >
                    <DialogTitle id='confirm-delete-title'>
                      Подтвердите удаление
                    </DialogTitle>
                    <DialogContent>
                      <DialogContentText>
                        Вы уверены, что хотите удалить это изображение?
                      </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                      <Button
                        onClick={() => setFileToDelete(null)}
                        color='primary'
                      >
                        Отмена
                      </Button>
                      <Button
                        onClick={handleDeleteConfirmed}
                        color='secondary'
                        autoFocus
                      >
                        Удалить
                      </Button>
                    </DialogActions>
                  </Dialog>
                </Box>
              </Paper>
            </Grid>
          )}
        </Grid>
      </Box>
    </>
  );
}

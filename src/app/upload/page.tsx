// app/upload/page.tsx

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  // Получаем параметры из URL
  const taskId = searchParams.get('taskId');
  const taskNameParam = searchParams.get('taskName');
  const bsNumberParam = searchParams.get('bsNumber');
  const executorName = searchParams.get('executorName');
  const executorId = searchParams.get('executorId');
  const initiatorName = searchParams.get('initiatorName');
  const initiatorId = searchParams.get('initiatorId');

  console.log(`taskId: ${taskId}`);
  console.log(`executor: ${executorName} ${executorId}`);
  console.log(`initiator: ${initiatorName} ${initiatorId}`);

  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [baseId, setBaseId] = useState(decodeURIComponent(bsNumberParam || ''));
  const [task, setTask] = useState(
    `${decodeURIComponent(taskNameParam || '')} | ${decodeURIComponent(
      bsNumberParam || ''
    )}`
  );
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
    formData.append('taskId', taskId || 'unknown');

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
                <Typography variant='h6'>Требования к ФО</Typography>
              </AccordionSummary>
              <AccordionDetails>
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
                    label='Task'
                    value={task}
                    InputProps={{
                      readOnly: true,
                    }}
                    margin='normal'
                  />
                  <TextField
                    fullWidth
                    label='BS Number'
                    value={baseId}
                    InputProps={{
                      readOnly: true,
                    }}
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

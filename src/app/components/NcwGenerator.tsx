// app/components/NcwGenerator.tsx
'use client';

import { useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { PdfTemplate } from './PdfTemplate';
import { PDFViewer, PDFDownloadLink, pdf } from '@react-pdf/renderer';
import {
    TextField,
    Button,
    Stack,
    Typography,
    Box,
    Alert,
    CircularProgress,
    Snackbar,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import SaveIcon from '@mui/icons-material/Save';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');

type Props = {
    /** Можно пробросить taskId пропсом из страницы задачи */
    taskId?: string;
};

type SnackState = { open: boolean; msg: string; severity: 'success' | 'error' };

function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}

export const NcwGenerator = ({ taskId: taskIdProp }: Props) => {
    /* ─────────────── безопасно читаем query-параметры ─────────────── */
    const params = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();

    // Попытка вытащить taskId: приоритет пропса, затем query, затем из URL /tasks/[taskId]
    const taskIdFromQuery = params?.get('taskId') ?? '';
    const taskIdFromPath = useMemo(() => {
        // ожидаем путь типа /tasks/E404Q или /app/org/.../tasks/E404Q
        const parts = (pathname || '').split('/').filter(Boolean);
        const ix = parts.lastIndexOf('tasks');
        if (ix >= 0 && parts[ix + 1]) return parts[ix + 1];
        return '';
    }, [pathname]);

    const taskId = (taskIdProp || taskIdFromQuery || taskIdFromPath || '').toUpperCase();

    const initialOrderNumber = params?.get('orderNumber') ?? '';
    const initialOrderDate = params?.get('orderDate') ? dayjs(params.get('orderDate') as string) : null;
    const initialCompletionDate = params?.get('completionDate')
        ? dayjs(params.get('completionDate') as string)
        : null;
    const initialObjectNumber = params?.get('objectNumber') ?? '';
    const initialObjectAddress = params?.get('objectAddress') ?? '';

    /* ─────────────── состояния ─────────────── */
    const [contractNumber, setContractNumber] = useState('27-1/25');
    const [contractDate, setContractDate] = useState<Dayjs | null>(dayjs('2025-04-07'));

    const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
    const [objectNumber, setObjectNumber] = useState(initialObjectNumber);
    const [objectAddress, setObjectAddress] = useState(initialObjectAddress);

    const [orderDate, setOrderDate] = useState<Dayjs | null>(initialOrderDate);
    const [completionDate, setCompletionDate] = useState<Dayjs | null>(initialCompletionDate);

    const [saving, setSaving] = useState(false);
    const [snack, setSnack] = useState<SnackState>({
        open: false,
        msg: '',
        severity: 'success',
    });

    /* ─────────────── валидация ─────────────── */
    const isValid =
        !!contractNumber &&
        !!contractDate &&
        !!orderNumber &&
        !!objectNumber &&
        !!objectAddress &&
        !!orderDate &&
        !!completionDate &&
        completionDate.isAfter(orderDate);

    /* ─────────────── данные для PDF ─────────────── */
    const formData = {
        orderNumber,
        objectNumber,
        objectAddress,
        contractNumber,
        contractDate: contractDate?.format('DD.MM.YYYY') || '',
        orderDate: orderDate?.format('DD.MM.YYYY') || '',
        completionDate: completionDate?.format('DD.MM.YYYY') || '',
    };

    /** Служебное: генерация Blob из React-PDF и загрузка в задачу */
    const handleSaveToTask = async () => {
        setSaving(true);
        try {
            if (!taskId) {
                setSnack({ open: true, msg: 'Не удалось определить taskId', severity: 'error' });
                return;
            }
            if (!isValid || !completionDate) {
                setSnack({ open: true, msg: 'Заполните форму корректно', severity: 'error' });
                return;
            }

            // 1) генерим PDF как Blob
            const instance = pdf(<PdfTemplate {...formData} />);
            const blob = await instance.toBlob();

            // 2) собираем FormData для PATCH /api/tasks/[taskId]
            const fd = new FormData();
            fd.append('workCompletionDate', completionDate.toDate().toISOString());
            // имя файла — как при скачивании
            const filename = `Уведомление_${orderNumber || taskId}.pdf`;
            fd.append('ncwFile', blob, filename);

// 3) отправляем
            const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
                method: 'PATCH',
                body: fd,
            });

            if (!response.ok) {
                const data = (await response.json().catch(() => null)) as { error?: string } | null;
                const msg = data?.error ?? `HTTP ${response.status}`;
                setSnack({ open: true, msg: `Ошибка сохранения: ${msg}`, severity: 'error' });
                return;
            }

// успех - переходим на страницу задачи
            router.push(`/tasks/${encodeURIComponent(taskId)}`);
            return; // чтобы не продолжать выполнение функции


            setSnack({ open: true, msg: 'Уведомление сохранено в задачу', severity: 'success' });
        } catch (e: unknown) {
            setSnack({ open: true, msg: `Ошибка сохранения: ${errorMessage(e)}`, severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    /* ─────────────── UI ─────────────── */
    return (
        <Stack spacing={3} maxWidth={600} mx="auto" mt={4}>
            <Typography variant="h5">Генерация уведомления о завершении работ</Typography>

            <TextField
                label="Номер договора"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
                fullWidth
            />

            <DatePicker
                label="Дата договора"
                format="DD.MM.YYYY"
                value={contractDate}
                onChange={setContractDate}
                slotProps={{ textField: { fullWidth: true } }}
            />

            <TextField
                label="Номер заказа"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                fullWidth
            />

            <DatePicker
                label="Дата заказа"
                format="DD.MM.YYYY"
                value={orderDate}
                onChange={setOrderDate}
                slotProps={{ textField: { fullWidth: true } }}
            />

            <DatePicker
                label="Дата окончания работ"
                format="DD.MM.YYYY"
                value={completionDate}
                onChange={setCompletionDate}
                slotProps={{ textField: { fullWidth: true } }}
            />

            {orderDate && completionDate && completionDate.isBefore(orderDate) && (
                <Alert severity="error">Дата окончания работ не может быть раньше даты заказа.</Alert>
            )}

            <TextField
                label="Номер объекта"
                value={objectNumber}
                onChange={(e) => setObjectNumber(e.target.value)}
                fullWidth
            />

            <TextField
                label="Адрес объекта"
                value={objectAddress}
                onChange={(e) => setObjectAddress(e.target.value)}
                fullWidth
                multiline
                rows={3}
            />

            {isValid && (
                <>
                    <Typography variant="h6">Предпросмотр:</Typography>
                    <Box height={600}>
                        <PDFViewer width="100%" height="100%">
                            <PdfTemplate {...formData} />
                        </PDFViewer>
                    </Box>

                    <Box display="flex" gap={2} justifyContent="center" mt={2} flexWrap="wrap">
                        <PDFDownloadLink document={<PdfTemplate {...formData} />} fileName={`Уведомление_${orderNumber}.pdf`}>
                            {({ loading }) => (
                                <Button variant="contained" color="primary" startIcon={<CloudDownloadIcon />}>
                                    {loading ? (
                                        <>
                                            <CircularProgress size={18} sx={{ mr: 1, color: 'inherit' }} />
                                            Генерация…
                                        </>
                                    ) : (
                                        'Скачать PDF'
                                    )}
                                </Button>
                            )}
                        </PDFDownloadLink>

                        <Button
                            variant="outlined"
                            startIcon={<SaveIcon />}
                            disabled={saving}
                            onClick={handleSaveToTask}
                            title={taskId ? `Сохранить в задачу ${taskId}` : 'taskId не определён'}
                        >
                            {saving ? (
                                <>
                                    <CircularProgress size={18} sx={{ mr: 1 }} />
                                    Сохранение…
                                </>
                            ) : (
                                'Сохранить в задачу'
                            )}
                        </Button>
                    </Box>
                </>
            )}

            <Snackbar
                open={snack.open}
                onClose={() => setSnack((s) => ({ ...s, open: false }))}
                message={snack.msg}
                autoHideDuration={4000}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            />
        </Stack>
    );
};

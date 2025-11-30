'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { PDFDownloadLink, PDFViewer, pdf } from '@react-pdf/renderer';
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import SaveIcon from '@mui/icons-material/Save';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ru';
import { PdfTemplate } from '@/app/components/PdfTemplate';

dayjs.locale('ru');

type Props = {
    taskId?: string;
    orgSlug?: string;
    initialOrderNumber?: string | null;
    initialOrderDate?: string | null;
    initialOrderSignDate?: string | null;
    initialBsNumber?: string | null;
    initialAddress?: string | null;
    open?: boolean;
    onSaved?: (url?: string) => void;
    onClose?: () => void;
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

function toDayjs(value?: string | null): Dayjs | null {
    if (!value) return null;
    const d = dayjs(value);
    return d.isValid() ? d : null;
}

export const T2NcwGenerator = ({
    taskId: taskIdProp,
    orgSlug,
    initialOrderNumber,
    initialOrderDate,
    initialOrderSignDate,
    initialBsNumber,
    initialAddress,
    open = true,
    onSaved,
    onClose,
}: Props) => {
    const params = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();

    const taskIdFromQuery = params?.get('taskId') ?? '';
    const taskIdFromPath = useMemo(() => {
        const parts = (pathname || '').split('/').filter(Boolean);
        const ix = parts.lastIndexOf('tasks');
        if (ix >= 0 && parts[ix + 1]) return parts[ix + 1];
        return '';
    }, [pathname]);

    const taskId = (taskIdProp || taskIdFromQuery || taskIdFromPath || '').toUpperCase();

    const initialOrderNumberFromParams = params?.get('orderNumber') ?? '';
    const initialOrderDateFromParams = params?.get('orderDate')
        ? dayjs(params.get('orderDate') as string)
        : null;
    const initialCompletionDateFromParams = params?.get('completionDate')
        ? dayjs(params.get('completionDate') as string)
        : null;
    const initialObjectNumberFromParams = params?.get('objectNumber') ?? '';
    const initialObjectAddressFromParams = params?.get('objectAddress') ?? '';

    const [contractNumber, setContractNumber] = useState('27-1/25');
    const [contractDate, setContractDate] = useState<Dayjs | null>(dayjs('2025-04-07'));

    const [orderNumber, setOrderNumber] = useState(initialOrderNumberFromParams);
    const [objectNumber, setObjectNumber] = useState(initialObjectNumberFromParams);
    const [objectAddress, setObjectAddress] = useState(initialObjectAddressFromParams);

    const [orderDate, setOrderDate] = useState<Dayjs | null>(initialOrderDateFromParams);
    const [completionDate, setCompletionDate] = useState<Dayjs | null>(initialCompletionDateFromParams);

    const [saving, setSaving] = useState(false);
    const [snack, setSnack] = useState<SnackState>({
        open: false,
        msg: '',
        severity: 'success',
    });

    useEffect(() => {
        const nextOrderNumber = initialOrderNumber ?? initialOrderNumberFromParams;
        const nextOrderDate =
            toDayjs(initialOrderDate) ??
            (initialOrderDateFromParams?.isValid() ? initialOrderDateFromParams : null);
        const nextCompletion =
            initialCompletionDateFromParams?.isValid()
                ? initialCompletionDateFromParams
                : toDayjs(initialOrderSignDate) ?? nextOrderDate ?? null;
        const nextObjectNumber = initialBsNumber ?? initialObjectNumberFromParams;
        const nextObjectAddress = initialAddress ?? initialObjectAddressFromParams;

        setContractNumber('27-1/25');
        setContractDate(dayjs('2025-04-07'));
        setOrderNumber(nextOrderNumber ?? '');
        setObjectNumber(nextObjectNumber ?? '');
        setObjectAddress(nextObjectAddress ?? '');
        setOrderDate(nextOrderDate ?? null);
        setCompletionDate(nextCompletion ?? null);
    }, [
        initialOrderNumber,
        initialOrderDate,
        initialOrderSignDate,
        initialBsNumber,
        initialAddress,
        initialOrderNumberFromParams,
        initialOrderDateFromParams,
        initialCompletionDateFromParams,
        initialObjectNumberFromParams,
        initialObjectAddressFromParams,
        open,
    ]);

    const isValid =
        !!contractNumber &&
        !!contractDate &&
        !!orderNumber &&
        !!objectNumber &&
        !!objectAddress &&
        !!orderDate &&
        !!completionDate &&
        completionDate.isAfter(orderDate);

    const formData = {
        orderNumber,
        objectNumber,
        objectAddress,
        contractNumber,
        contractDate: contractDate?.format('DD.MM.YYYY') || '',
        orderDate: orderDate?.format('DD.MM.YYYY') || '',
        completionDate: completionDate?.format('DD.MM.YYYY') || '',
    };

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

            const instance = pdf(<PdfTemplate {...formData} />);
            const blob = await instance.toBlob();

            const fd = new FormData();
            const filename = `Уведомление_${orderNumber || taskId}.pdf`;
            fd.append('file', blob, filename);
            fd.append('taskId', taskId);
            fd.append('subfolder', 'documents');
            if (orgSlug) fd.append('orgSlug', orgSlug);

            const uploadResponse = await fetch('/api/upload', {
                method: 'POST',
                body: fd,
            });

            let uploadBody: unknown = null;
            try {
                uploadBody = await uploadResponse.json();
            } catch {
                /* ignore */
            }

            if (!uploadResponse.ok) {
                const msg =
                    uploadBody &&
                    typeof uploadBody === 'object' &&
                    'error' in uploadBody &&
                    typeof (uploadBody as { error?: unknown }).error === 'string'
                        ? (uploadBody as { error?: string }).error
                        : `HTTP ${uploadResponse.status}`;
                setSnack({ open: true, msg: `Ошибка сохранения: ${msg}`, severity: 'error' });
                return;
            }

            const uploadedUrl =
                uploadBody &&
                typeof uploadBody === 'object' &&
                'urls' in uploadBody &&
                Array.isArray((uploadBody as { urls?: unknown }).urls) &&
                (uploadBody as { urls: unknown[] }).urls.length > 0
                    ? String((uploadBody as { urls: unknown[] }).urls[0])
                    : undefined;

            if (completionDate) {
                const metaResponse = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        workCompletionDate: completionDate.toDate().toISOString(),
                        ncwUrl: uploadedUrl,
                    }),
                });

                if (!metaResponse.ok) {
                    const metaBody = await metaResponse.json().catch(() => null);
                    const msg =
                        metaBody &&
                        typeof metaBody === 'object' &&
                        'error' in metaBody &&
                        typeof (metaBody as { error?: unknown }).error === 'string'
                            ? (metaBody as { error?: string }).error
                            : `HTTP ${metaResponse.status}`;
                    setSnack({
                        open: true,
                        msg: `Ошибка сохранения данных задачи: ${msg}`,
                        severity: 'error',
                    });
                    return;
                }
            }

            setSnack({ open: true, msg: 'Уведомление сохранено', severity: 'success' });

            if (onSaved) {
                onSaved(uploadedUrl);
            } else {
                onClose?.();
                router.push(`/tasks/${encodeURIComponent(taskId)}`);
            }
        } catch (e: unknown) {
            setSnack({ open: true, msg: `Ошибка сохранения: ${errorMessage(e)}`, severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Stack spacing={3} maxWidth={600} mx="auto" mt={open ? 4 : 0}>
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

export const NcwGenerator = T2NcwGenerator;

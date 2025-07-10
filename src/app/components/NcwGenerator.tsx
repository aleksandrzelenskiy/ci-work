'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PdfTemplate } from './PdfTemplate';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { TextField, Button, Stack, Typography } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import 'dayjs/locale/ru';
import dayjs from 'dayjs';
import { Dayjs } from 'dayjs';
import { Box } from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';

dayjs.locale('ru');

export const NcwGenerator = () => {

    const params = useSearchParams();
      const initialOrderNumber = params.get('orderNumber') || '';
      const initialOrderDate = params.get('orderDate')
        ? dayjs(params.get('orderDate'))
            : null;
      const initialCompletionDate = params.get('completionDate')
        ? dayjs(params.get('completionDate'))
            : null;
      const initialObjectNumber = params.get('objectNumber') || '';
      const initialObjectAddress = params.get('objectAddress') || '';

    // Добавляем состояния для пропсов договора
    const [contractNumber, setContractNumber] = useState('27-1/25');
    const [contractDate, setContractDate] = useState<Dayjs | null>(dayjs('2025-04-07'));

    const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
    const [objectNumber, setObjectNumber] = useState(initialObjectNumber);
    const [objectAddress, setObjectAddress] = useState(initialObjectAddress);

    const [orderDate, setOrderDate] = useState<Dayjs | null>(initialOrderDate);
      const [completionDate, setCompletionDate] = useState<Dayjs | null>(
            initialCompletionDate
          );

    const isValid =
        contractNumber &&
        contractDate &&
        orderNumber &&
        objectNumber &&
        objectAddress &&
        orderDate &&
        completionDate &&
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

    return (
        <Stack spacing={3} maxWidth={600} mx="auto" mt={4}>
            <Typography variant="h5">Генерация уведомления о завершении работ</Typography>

            {/* Добавляем поля для данных договора */}
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
                <Typography color="error">
                    Дата окончания работ не может быть раньше даты заказа.
                </Typography>
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
                    <div style={{ height: 600 }}>
                        <PDFViewer width="100%" height="100%">
                            <PdfTemplate {...formData} />
                        </PDFViewer>
                    </div>

                    <Box display="flex" justifyContent="center" mt={2}>
                        <PDFDownloadLink
                            document={<PdfTemplate {...formData} />}
                            fileName={`Уведомление_${orderNumber}.pdf`}
                        >
                            {({ loading }) => (
                                <Button variant="contained" color="primary" startIcon={<CloudDownloadIcon />}>
                                    {loading ? 'Генерация...' : 'Скачать PDF'}
                                </Button>
                            )}
                        </PDFDownloadLink>
                    </Box>
                </>
            )}
        </Stack>
    );
};
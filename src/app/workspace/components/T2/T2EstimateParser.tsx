'use client';

import React, { useCallback, useState } from 'react';
import {
    Box,
    Typography,
    Button,
    LinearProgress,
    Alert,
    Collapse,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Paper,
} from '@mui/material';
import { useDropzone, FileRejection } from 'react-dropzone';
import CloseIcon from '@mui/icons-material/Close';

interface ExcelData {
    [sheetName: string]: Array<Record<string, unknown>>;
}

export type ParsedWorkItem = {
    workType: string;
    quantity: number;
    unit: string;
    note?: string;
};

export type ParsedEstimateResult = {
    bsNumber?: string;
    bsAddress?: string;
    totalCost?: number;
    workItems: ParsedWorkItem[];
    sourceFile?: File;
};

type Props = {
    open: boolean;
    onClose: () => void;
    onApply: (data: ParsedEstimateResult) => void;
};

const T2EstimateParser: React.FC<Props> = ({ open, onClose, onApply }) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [excelData, setExcelData] = useState<ExcelData | null>(null);
    const [bsNumber, setBsNumber] = useState<string | null>(null);
    const [bsAddress, setBsAddress] = useState<string | null>(null);
    const [total, setTotal] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const resetState = () => {
        setFile(null);
        setUploading(false);
        setUploadProgress(0);
        setExcelData(null);
        setBsNumber(null);
        setBsAddress(null);
        setTotal(null);
        setError(null);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const findValueByLabel = (data: ExcelData, label: string): string | number | null => {
        for (const sheet of Object.values(data)) {
            for (const row of sheet) {
                const labelEntry = Object.entries(row).find(
                    ([, value]) => value === label
                );

                if (labelEntry) {
                    const [labelKey] = labelEntry;
                    const keys = Object.keys(row);
                    const labelIndex = keys.indexOf(labelKey);

                    if (labelIndex !== -1 && labelIndex < keys.length - 1) {
                        const valueKey = keys[labelIndex + 1];
                        const value = row[valueKey];

                        if (typeof value === 'string' || typeof value === 'number') {
                            return value;
                        }
                    }
                }
            }
        }
        return null;
    };

    const parseMainValues = (data: ExcelData) => {
        const totalVal = findValueByLabel(data, 'Итого с учетом Коэф.') as number | null;
        setTotal(totalVal ?? null);

        const bsNum = findValueByLabel(data, 'Номер БС:') as string | null;
        const bsAddr = findValueByLabel(data, 'Адрес БС:') as string | null;

        setBsNumber(bsNum ?? null);
        setBsAddress(bsAddr ?? null);
    };

    const getTableData = (): ParsedWorkItem[] => {
        if (!excelData) return [];

        const excludedValues = [
            'сайт',
            'комплект',
            'шт.',
            'м.куб.',
            'м.кв.',
            'т.',
            'оттяжка',
            'м.п.',
            'смена',
            'км.',
            'талреп',
            'перекрытие',
            'шт',
            'шт. ',
        ];

        return Object.values(excelData)
            .flat()
            .filter((row) => {
                const quantity = row['__EMPTY_2'];
                const empty1Value = String(row['__EMPTY_1']);

                return (
                    row['__EMPTY_1'] &&
                    typeof quantity === 'number' &&
                    quantity !== 0 &&
                    row['__EMPTY_3'] &&
                    !excludedValues.includes(empty1Value)
                );
            })
            .map((row) => ({
                workType: String(row['__EMPTY_1']),
                quantity: Number(row['__EMPTY_2']),
                unit: String(row['__EMPTY_3']),
                note: row['__EMPTY_17'] ? String(row['__EMPTY_17']) : '',
            }));
    };

    const onDrop = useCallback(
        (acceptedFiles: File[], fileRejections: FileRejection[]) => {
            setError(null);
            setExcelData(null);
            setBsNumber(null);
            setBsAddress(null);
            setTotal(null);

            if (fileRejections.length > 0) {
                setError('Файл отклонён. Загрузите корректный Excel (.xlsx / .xls).');
            }

            if (acceptedFiles.length > 0) {
                setFile(acceptedFiles[0]);
            }
        },
        []
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
        },
        maxFiles: 1,
        multiple: false,
    });

    const handleUpload = async () => {
        if (!file) return;

        try {
            setUploading(true);
            setUploadProgress(10);
            setError(null);

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/estimates', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const result = await response.json().catch(() => ({}));
                throw new Error(result.error || 'Ошибка разбора файла');
            }

            setUploadProgress(70);
            const result = await response.json();
            const data = result.data as ExcelData;

            setExcelData(data);
            parseMainValues(data);
            setUploadProgress(100);
        } catch (e) {
            console.error(e);
            setError(e instanceof Error ? e.message : 'Ошибка при разборе файла');
        } finally {
            setUploading(false);
            setTimeout(() => setUploadProgress(0), 800);
        }
    };

    const handleApply = () => {
        const workItems = getTableData();

        onApply({
            bsNumber: bsNumber || undefined,
            bsAddress: bsAddress || undefined,
            totalCost: typeof total === 'number' ? total : undefined,
            workItems,
            sourceFile: file || undefined,
        });

        resetState();
        onClose();
    };

    const canApply = !!excelData;

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
            <DialogTitle>Заполнить по смете (Tele2)</DialogTitle>
            <DialogContent dividers>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <Box
                        {...getRootProps()}
                        sx={{
                            border: '2px dashed #1976d2',
                            borderRadius: 2,
                            p: 2,
                            cursor: 'pointer',
                            backgroundColor: isDragActive ? '#e3f2fd' : '#fafafa',
                            transition: 'background-color 0.3s',
                            textAlign: 'center',
                        }}
                    >
                        <input {...getInputProps()} />
                        <Typography variant="body2">
                            {isDragActive
                                ? 'Отпустите файл для загрузки'
                                : file
                                    ? `Выбран файл: ${file.name}`
                                    : 'Перетащите Excel-смету сюда или нажмите, чтобы выбрать'}
                        </Typography>
                    </Box>

                    {file && (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                size="small"
                                variant="contained"
                                onClick={handleUpload}
                                disabled={uploading}
                            >
                                {uploading ? 'Обработка...' : 'Распарсить смету'}
                            </Button>
                            <Button
                                size="small"
                                variant="text"
                                onClick={resetState}
                                disabled={uploading}
                            >
                                Сбросить
                            </Button>
                        </Box>
                    )}

                    {uploading && (
                        <LinearProgress
                            variant="determinate"
                            value={uploadProgress}
                            sx={{ mt: 0.5 }}
                        />
                    )}

                    <Collapse in={!!error}>
                        {error && (
                            <Alert
                                severity="error"
                                sx={{ mt: 1 }}
                                action={
                                    <IconButton
                                        size="small"
                                        color="inherit"
                                        onClick={() => setError(null)}
                                    >
                                        <CloseIcon fontSize="inherit" />
                                    </IconButton>
                                }
                            >
                                {error}
                            </Alert>
                        )}
                    </Collapse>

                    {(bsNumber || bsAddress || typeof total === 'number') && (
                        <Box sx={{ mt: 1 }}>
                            {bsNumber && (
                                <Typography variant="body2">
                                    <b>БС:</b> {bsNumber}
                                </Typography>
                            )}
                            {bsAddress && (
                                <Typography variant="body2">
                                    <b>Адрес:</b> {bsAddress}
                                </Typography>
                            )}
                            {typeof total === 'number' && (
                                <Typography variant="body2">
                                    <b>Сумма сметы, ₽:</b> {total.toFixed(2)}
                                </Typography>
                            )}
                        </Box>
                    )}

                    {excelData && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                                Состав работ из сметы
                            </Typography>
                            <Paper variant="outlined">
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Вид работ</TableCell>
                                            <TableCell>Кол-во</TableCell>
                                            <TableCell>Ед.</TableCell>
                                            <TableCell>Примечание</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {getTableData().map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{item.workType}</TableCell>
                                                <TableCell>{item.quantity}</TableCell>
                                                <TableCell>{item.unit}</TableCell>
                                                <TableCell>{item.note}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Paper>
                        </Box>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Отмена</Button>
                <Button
                    onClick={handleApply}
                    variant="contained"
                    disabled={!canApply}
                >
                    Применить к задаче
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default T2EstimateParser;

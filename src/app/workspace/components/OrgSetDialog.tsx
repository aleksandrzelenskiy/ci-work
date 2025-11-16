'use client';

import * as React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    Stack,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    IconButton,
    Tooltip,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EditNoteIcon from '@mui/icons-material/EditNote';
import DoneIcon from '@mui/icons-material/Done';

export type OrgSettingsFormValues = {
    plan: 'basic' | 'pro' | 'business';
    legalForm: 'ООО' | 'ИП' | 'АО' | 'ЗАО';
    organizationName: string;
    legalAddress: string;
    inn: string;
    kpp: string;
    ogrn: string;
    okpo?: string;
    bik: string;
    bankName: string;
    correspondentAccount: string;
    settlementAccount: string;
    directorTitle: string;
    directorName: string;
    directorBasis: string;
    contacts: string;
};

export const defaultOrgSettings: OrgSettingsFormValues = {
    plan: 'basic',
    legalForm: 'ООО',
    organizationName: '',
    legalAddress: '',
    inn: '',
    kpp: '',
    ogrn: '',
    okpo: '',
    bik: '',
    bankName: '',
    correspondentAccount: '',
    settlementAccount: '',
    directorTitle: '',
    directorName: '',
    directorBasis: '',
    contacts: '',
};

type OrgSetDialogProps = {
    open: boolean;
    loading?: boolean;
    initialValues?: OrgSettingsFormValues | null;
    onCloseAction: () => void;
    onSubmit: (values: OrgSettingsFormValues) => void;
};

const LEGAL_FORMS: OrgSettingsFormValues['legalForm'][] = ['ООО', 'ИП', 'АО', 'ЗАО'];

export default function OrgSetDialog({
                                         open,
                                         loading = false,
                                         initialValues,
                                         onCloseAction,
                                         onSubmit,
                                     }: OrgSetDialogProps) {
    const [form, setForm] = React.useState<OrgSettingsFormValues>(defaultOrgSettings);
    const [isEditing, setIsEditing] = React.useState(false);

    React.useEffect(() => {
        if (!open) return;
        const hasInitial = Boolean(initialValues);
        setForm({ ...defaultOrgSettings, ...(initialValues ?? {}) });
        setIsEditing(!hasInitial);
    }, [open, initialValues]);

    const handleChange = (field: keyof OrgSettingsFormValues) =>
        (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const { value } = event.target;
            setForm((prev) => ({ ...prev, [field]: value }));
        };

    const handleLegalFormChange = (event: SelectChangeEvent<OrgSettingsFormValues['legalForm']>) => {
        setForm((prev) => ({ ...prev, legalForm: event.target.value as OrgSettingsFormValues['legalForm'] }));
    };

    const handleSubmit = () => {
        onSubmit(form);
    };

    const disableSubmit = loading || !form.organizationName.trim() || !form.inn.trim();
    const submitDisabled = !isEditing || disableSubmit;

    const hasExistingData = Boolean(initialValues);
    const requisitesTitle = form.organizationName?.trim() || initialValues?.organizationName?.trim() || 'организации';

    const isIndividualEntrepreneur = form.legalForm === 'ИП';

    return (
        <Dialog open={open} onClose={loading ? undefined : onCloseAction} maxWidth="md" fullWidth>
            <DialogTitle>Настройки организации</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={1.5} sx={{ mb: 2 }}>

                </Stack>

                {isEditing ? (
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <Stack spacing={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="legal-form-label">Форма</InputLabel>
                                <Select
                                    labelId="legal-form-label"
                                    label="Форма"
                                    value={form.legalForm}
                                    onChange={handleLegalFormChange}
                                    disabled={loading}
                                >
                                    {LEGAL_FORMS.map((option) => (
                                        <MenuItem key={option} value={option}>
                                            {option}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <TextField
                                label="Наименование организации"
                                value={form.organizationName}
                                onChange={handleChange('organizationName')}
                                fullWidth
                                size="small"
                                disabled={loading}
                            />
                            <TextField
                                label="Юридический адрес"
                                value={form.legalAddress}
                                onChange={handleChange('legalAddress')}
                                fullWidth
                                size="small"
                                disabled={loading}
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    label="ИНН"
                                    value={form.inn}
                                    onChange={handleChange('inn')}
                                    fullWidth
                                    size="small"
                                    disabled={loading}
                                />
                                <TextField
                                    label="КПП"
                                    value={form.kpp}
                                    onChange={handleChange('kpp')}
                                    fullWidth
                                    size="small"
                                    disabled={loading}
                                />
                            </Stack>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    label="ОГРН / ОГРНИП"
                                    value={form.ogrn}
                                    onChange={handleChange('ogrn')}
                                    fullWidth
                                    size="small"
                                    disabled={loading}
                                />
                                <TextField
                                    label="ОКПО (необязательно)"
                                    value={form.okpo}
                                    onChange={handleChange('okpo')}
                                    fullWidth
                                    size="small"
                                    disabled={loading}
                                />
                            </Stack>
                        </Stack>

                        <Stack spacing={2}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    label="БИК"
                                    value={form.bik}
                                    onChange={handleChange('bik')}
                                    fullWidth
                                    size="small"
                                    disabled={loading}
                                />
                                <TextField
                                    label="Банк"
                                    value={form.bankName}
                                    onChange={handleChange('bankName')}
                                    fullWidth
                                    size="small"
                                    disabled={loading}
                                />
                            </Stack>
                            <TextField
                                label="Корреспондентский счёт"
                                value={form.correspondentAccount}
                                onChange={handleChange('correspondentAccount')}
                                fullWidth
                                size="small"
                                disabled={loading}
                            />
                            <TextField
                                label="Расчётный счёт"
                                value={form.settlementAccount}
                                onChange={handleChange('settlementAccount')}
                                fullWidth
                                size="small"
                                disabled={loading}
                            />
                        </Stack>

                        {!isIndividualEntrepreneur && (
                            <Stack spacing={2}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                    <TextField
                                        label="Должность"
                                        value={form.directorTitle}
                                        onChange={handleChange('directorTitle')}
                                        fullWidth
                                        size="small"
                                        disabled={loading}
                                    />
                                    <TextField
                                        label="ФИО"
                                        value={form.directorName}
                                        onChange={handleChange('directorName')}
                                        fullWidth
                                        size="small"
                                        disabled={loading}
                                    />
                                </Stack>
                                <TextField
                                    label="Основание действий"
                                    value={form.directorBasis}
                                    onChange={handleChange('directorBasis')}
                                    fullWidth
                                    size="small"
                                    disabled={loading}
                                />
                            </Stack>
                        )}

                        <TextField
                            label="Контактные данные"
                            value={form.contacts}
                            onChange={handleChange('contacts')}
                            fullWidth
                            multiline
                            minRows={3}
                            disabled={loading}
                        />
                    </Stack>
                ) : (
                    <Accordion>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                                <Typography variant="subtitle1" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    Реквизиты {requisitesTitle}
                                    {hasExistingData && (
                                        <Tooltip title="Изменить реквизиты">
                                            <span>
                                                <IconButton
                                                    size="small"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setIsEditing(true);
                                                    }}
                                                >
                                                    <EditNoteIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    )}
                                </Typography>
                                {hasExistingData && <DoneIcon color="success" fontSize="small" />}
                            </Stack>
                        </AccordionSummary>
                        <AccordionDetails>
                            {hasExistingData ? (
                                <Stack spacing={1.5} sx={{ mt: 1 }}>
                                    <Typography variant="body2"><strong>Форма:</strong> {form.legalForm || '—'}</Typography>
                                    <Typography variant="body2"><strong>Наименование:</strong> {form.organizationName || '—'}</Typography>
                                    <Typography variant="body2"><strong>Юр. адрес:</strong> {form.legalAddress || '—'}</Typography>
                                    <Typography variant="body2"><strong>ИНН / КПП:</strong> {form.inn || '—'} / {form.kpp || '—'}</Typography>
                                    <Typography variant="body2"><strong>ОГРН / ОГРНИП:</strong> {form.ogrn || '—'}</Typography>
                                    <Typography variant="body2"><strong>ОКПО:</strong> {form.okpo || '—'}</Typography>
                                    <Typography variant="body2"><strong>Банк:</strong> {form.bankName || '—'}</Typography>
                                    <Typography variant="body2"><strong>БИК:</strong> {form.bik || '—'}</Typography>
                                    <Typography variant="body2"><strong>К/с:</strong> {form.correspondentAccount || '—'}</Typography>
                                    <Typography variant="body2"><strong>Р/с:</strong> {form.settlementAccount || '—'}</Typography>
                                    {!isIndividualEntrepreneur && (
                                        <>
                                            <Typography variant="body2">
                                                <strong>Руководитель:</strong> {form.directorTitle || '—'} — {form.directorName || '—'}
                                            </Typography>
                                            <Typography variant="body2">
                                                <strong>Основание:</strong> {form.directorBasis || '—'}
                                            </Typography>
                                        </>
                                    )}
                                    <Typography variant="body2"><strong>Контакты:</strong> {form.contacts || '—'}</Typography>
                                </Stack>
                            ) : (
                                <Typography color="text.secondary">
                                    Реквизиты ещё не заполнены. Нажмите «Изменить реквизиты», чтобы добавить данные.
                                </Typography>
                            )}
                        </AccordionDetails>
                    </Accordion>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onCloseAction} disabled={loading}>
                    Закрыть
                </Button>
                <Button variant="contained" disabled={submitDisabled} onClick={handleSubmit}>
                    Сохранить
                </Button>
            </DialogActions>
        </Dialog>
    );
}

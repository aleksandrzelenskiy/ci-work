import { CORE_OPERATORS } from '@/app/constants/operators';

export const OPERATORS = CORE_OPERATORS;
export type OperatorCode = (typeof OPERATORS)[number]['value'];

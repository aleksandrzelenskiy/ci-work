export type OperatorOption = {
    value: string;
    name: string;
    label: string;
    visibleCode: string;
};

const RAW_OPERATORS: ReadonlyArray<{ value: string; name: string; visibleCode: string }> = [
    { value: '250020', name: 'T2', visibleCode: '250-20' },
    { value: '250099', name: 'Билайн', visibleCode: '250-99' },
    { value: '250002', name: 'Мегафон', visibleCode: '250-2' },
    { value: '250001', name: 'МТС', visibleCode: '250-1' },
] as const;

export const CORE_OPERATORS: readonly OperatorOption[] = RAW_OPERATORS.map((operator) => ({
    ...operator,
    label: `${operator.name} (${operator.visibleCode})`,
}));

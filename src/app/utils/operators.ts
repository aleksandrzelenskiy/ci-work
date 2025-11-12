const RUSSIAN_OPERATOR_SOURCE = {
  countryId: 1,
  name: 'Россия',
  englishName: 'Russia',
  operators: [
    { internalCode: '250001', name: 'МТС', visibleCode: '250-1' },
    { internalCode: '250002', name: 'Мегафон', visibleCode: '250-2' },
    { internalCode: '250099', name: 'Билайн', visibleCode: '250-99' },
    { internalCode: '250020', name: 'T2', visibleCode: '250-20' },
    { internalCode: '250035', name: 'Мотив', visibleCode: '250-35' },
    { internalCode: '250032', name: 'WIN', visibleCode: '250-32' },
    { internalCode: '250011', name: 'Yota', visibleCode: '250-11' },
    { internalCode: '250054', name: 'Миранда', visibleCode: '250-54' },
    { internalCode: '250060', name: 'Волна', visibleCode: '250-60' },
    { internalCode: '250098', name: 'МКС', visibleCode: '250-98' },
    { internalCode: '250094', name: 'МирТелеком', visibleCode: '250-94' },
    { internalCode: '250096', name: '+7 Телеком', visibleCode: '250-96' },
    { internalCode: '250039', name: 'УЦН 2G T2', visibleCode: '250-39' },
    { internalCode: '250027', name: 'Летай', visibleCode: '250-27' },
    { internalCode: '250007', name: 'УЦН 2G Мегафон', visibleCode: '250-7' },
    { internalCode: '250058', name: 'УЦН 2G МТС', visibleCode: '250-58' },
    { internalCode: '250097', name: 'Феникс', visibleCode: '250-97' },
    { internalCode: '250033', name: 'Севмобайл', visibleCode: '250-33' },
    { internalCode: '250008', name: 'Вайнах Телеком', visibleCode: '250-8' },
    { internalCode: '250499', visibleCode: '250-499' },
    { internalCode: '250250', visibleCode: '250-250' },
    { internalCode: '250003', visibleCode: '250-3' },
    { internalCode: '250070', visibleCode: '250-70' },
    { internalCode: '250051', visibleCode: '250-51' },
  ],
} as const;

type RawOperator = (typeof RUSSIAN_OPERATOR_SOURCE.operators)[number];

export const OPERATORS = RUSSIAN_OPERATOR_SOURCE.operators.map((operator) => {
  const title = operator.name ?? operator.visibleCode;
  return {
    value: operator.internalCode,
    label: operator.name ? `${operator.name} (${operator.visibleCode})` : operator.visibleCode,
    name: title,
    internalCode: operator.internalCode,
    visibleCode: operator.visibleCode,
    countryId: RUSSIAN_OPERATOR_SOURCE.countryId,
    countryName: RUSSIAN_OPERATOR_SOURCE.name,
    countryEnglishName: RUSSIAN_OPERATOR_SOURCE.englishName,
  };
}) as readonly {
  value: RawOperator['internalCode'];
  label: string;
  name: string;
  internalCode: RawOperator['internalCode'];
  visibleCode: RawOperator['visibleCode'];
  countryId: typeof RUSSIAN_OPERATOR_SOURCE.countryId;
  countryName: typeof RUSSIAN_OPERATOR_SOURCE.name;
  countryEnglishName: typeof RUSSIAN_OPERATOR_SOURCE.englishName;
}[];

export type OperatorCode = (typeof OPERATORS)[number]['value'];

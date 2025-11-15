export type BaseStationCollection = {
    regionCode: string;
    operator: string;
    collection: string;
};

export const BASE_STATION_COLLECTIONS: readonly BaseStationCollection[] = [
    {
        regionCode: '38',
        operator: '250020',
        collection: '38-t2-bs-coords',
    },
    // Добавляйте другие соответствия «регион + оператор → коллекция» по мере готовности данных
];

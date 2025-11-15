export { REGIONS as RUSSIAN_REGIONS, REGION_MAP, REGION_ISO_MAP } from '@/app/constants/regions';
export type RegionOption = (typeof RUSSIAN_REGIONS)[number];
export type RegionCode = RegionOption['code'];

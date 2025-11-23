//app/types/BaseStation.d.ts

import { Document } from 'mongoose';

export interface IBaseStation extends Document {
  name?: string;
  coordinates?: string;
  address?: string;
  lat?: number;
  lon?: number;
  coordKey?: string;
  source?: string;
  region?: string;
  regionCode?: string;
  op?: string;
  operatorCode?: string;
  mcc?: string;
  mnc?: string;
}

export interface BaseStationInput {
  name: string;
  coordinates: string;
  address?: string;
}

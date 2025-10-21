//app/types/BaseStation.d.ts

import { Document } from 'mongoose';

export interface IBaseStation extends Document {
  name: string;
  coordinates: string;
}

export interface BaseStationInput {
  name: string;
  coordinates: string;
}

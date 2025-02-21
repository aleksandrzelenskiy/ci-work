import { Typography } from '@mui/material';
import BaseStations from '../components/BaseStations';

export default function BaseStationsPage() {
  return (
    <div>
      <Typography align='center' variant='h5'>
        Catalog of BS
      </Typography>
      <BaseStations />
    </div>
  );
}

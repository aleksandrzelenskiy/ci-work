import { Typography } from '@mui/material';
import BaseStations from '../components/BaseStations';
import StorageIcon from '@mui/icons-material/Storage';

export default function BaseStationsPage() {
  return (
    <div>
      <Typography align='center' variant='h5'>
        <StorageIcon /> T2 IR Objects Base
      </Typography>
      <BaseStations />
    </div>
  );
}

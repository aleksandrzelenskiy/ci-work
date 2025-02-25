import TaskMap from '../components/TaskMap';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Task Map',
  description: '',
};

export default function MapPage() {
  return (
    <>
      <TaskMap />
    </>
  );
}

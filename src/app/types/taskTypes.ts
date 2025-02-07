// app/types/taskTypes.ts

export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low';
export type CurrentStatus =
  | 'to do'
  | 'assigned'
  | 'at work'
  | 'done'
  | 'agreed';

export interface WorkItem {
  workType: string;
  quantity: number;
  unit: string;
  note?: string;
  id: string;
}

export interface Task {
  taskId: string;
  taskName: string;
  bsNumber: string;
  bsAddress: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  taskDescription: string;
  totalCost: number;
  workItems: WorkItem[];
  author: string;
  initiator: string;
  initiatorId: string;
  executor: string;
  executorId: string;
  dueDate: Date;
  priority: PriorityLevel;
  status: CurrentStatus;
  createdAt: Date;
  attachments?: string[];
  orderUrl?: string[];
}

export interface CreateTaskPayload extends Omit<Task, '_id' | 'createdAt'> {
  attachments?: string[];
}

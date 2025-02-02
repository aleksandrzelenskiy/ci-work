export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low';

export interface WorkItem {
  workType: string;
  quantity: number;
  unit: string;
  note?: string;
}

export interface Task {
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
  executor?: string;
  author: string;
  initiator: string;
  dueDate: Date;
  priority: PriorityLevel;
  createdAt: Date;
  attachments?: string[];
  orderUrl?: string[];
}

export interface CreateTaskPayload extends Omit<Task, '_id' | 'createdAt'> {
  attachments?: string[];
}

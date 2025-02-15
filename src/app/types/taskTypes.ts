// app/types/taskTypes.ts

export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low';
export type CurrentStatus =
  | 'to do'
  | 'assigned'
  | 'at work'
  | 'done'
  | 'agreed';

export interface BsLocation {
  id: string;
  name: string;
  coordinates: string;
}
export interface WorkItem {
  workType: string;
  quantity: number;
  unit: string;
  note?: string;
  id?: string;
}

export interface TaskEvent {
  _id?: string;
  action: string;
  author: string;
  authorId: string;
  date: Date;
  details?: {
    oldStatus?: CurrentStatus;
    newStatus?: CurrentStatus;
    comment?: string;
  };
}

export interface Task {
  _id?: string;
  taskId: string;
  taskName: string;
  bsNumber: string;
  bsLocation: BsLocation[];
  bsAddress: string;
  taskDescription: string;
  totalCost: number;
  workItems: WorkItem[];
  authorId: string;
  authorEmail: string;
  authorName: string;
  initiatorId: string;
  initiatorName: string;
  initiatorEmail: string;
  executorId: string;
  executorName: string;
  executorEmail: string;
  dueDate: Date;
  priority: PriorityLevel;
  status: CurrentStatus;
  createdAt: Date;
  attachments?: string[];
  orderUrl?: string[];
  objectDetails: {
    name: string;
    coordinates: string;
  };
  events?: TaskEvent[];
}

export interface CreateTaskPayload extends Omit<Task, '_id' | 'createdAt'> {
  attachments?: string[];
}

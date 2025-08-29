// app/types/taskTypes.ts

export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low';

export type CurrentStatus =
    | 'To do'
    | 'Assigned'
    | 'At work'
    | 'Done'
    | 'Pending'
    | 'Issues'
    | 'Fixed'
    | 'Agreed';

// Тип задачи
export type TaskType = 'construction' | 'installation' | 'document';

// Тип обязательных вложений
export type RequiredAttachmentType = 'photo' | 'pdf' | 'doc' | 'dwg';

export interface BsLocation {
  id?: string;
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
    commentId?: string;
  };
}

export interface PhotoReport {
  _id: string;
  reportId: string;
  baseId: string;
  status: string;
  createdAt: Date;
  task: string;
  files: string[];
  fixedFiles: string[];
}

export interface Comment {
  profilePic: string | undefined;
  _id?: string;
  text: string;
  author: string;
  authorId: string;
  createdAt: Date;
  photoUrl?: string;
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

  taskType: TaskType; // construction | document
  requiredAttachments?: RequiredAttachmentType[]; // например ['photo'] или ['pdf', 'dwg']
  relatedTasks?: string[]; // массив ObjectId связанных задач
  approvedBy?: string; // кто согласовал
  approvedAt?: Date; // когда согласовали

  attachments?: string[];

  orderUrl?: string;
  orderNumber?: string;
  orderDate?: Date;
  orderSignDate?: Date;
  closingDocumentsUrl?: string;

  objectDetails: {
    name: string;
    coordinates: string;
  };

  events?: TaskEvent[];
  photoReports?: PhotoReport[];
  comments?: Comment[];
}

export interface CreateTaskPayload extends Omit<Task, '_id' | 'createdAt'> {
  attachments?: string[];
}

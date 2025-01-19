// /app/types/reportTypes.ts

export interface IEvent {
  action: string;
  author: string;
  authorId: string;
  date: Date;
  details?: Record<string, unknown>;
}

export interface IReport {
  _id: string;
  task: string;
  baseId: string;
  files: string[];
  fixedFiles: string[];
  issues: string[];
  status: string;
  createdAt: Date;
  userId: string;
  userName: string;
  reviewerId: string;
  reviewerName: string;
  events: IEvent[];
}

export interface BaseStatus {
  baseId: string;
  status: string;
  latestStatusChangeDate: string;
}

export interface ReportClient {
  _id: string;
  task: string;
  userId: string;
  userName: string;
  userAvatar: string;
  createdAt: string;
  baseStatuses: BaseStatus[];
}

export interface ApiResponse {
  reports: ReportClient[];
  error?: string;
}

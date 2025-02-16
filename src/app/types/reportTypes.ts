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
  reportId: string;
  task: string;
  baseId: string;
  files: string[];
  fixedFiles: string[];
  issues: string[];
  status: string;
  createdAt: Date;
  executorId: string;
  executorName: string;
  initiatorId: string;
  initiatorName: string;
  events: IEvent[];
}

export interface BaseStatus {
  baseId: string;
  status: string;
  latestStatusChangeDate: string;
}

export interface ReportClient {
  initiatorName: string | undefined;
  executorName: string | undefined;
  reviewerName: string | undefined;
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

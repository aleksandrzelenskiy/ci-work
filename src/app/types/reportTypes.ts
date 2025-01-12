// /app/types/reportTypes.ts

export interface IEvent {
  action: string; // Тип действия (e.g. 'REPORT_CREATED', 'ISSUES_EDITED', 'FIXED_PHOTOS')
  author: string; // Имя автора действия
  authorId: string; // ID автора действия (Clerk user ID)
  date: Date; // Когда было совершено
  details?: Record<string, unknown>; // Дополнительная информация
}

export interface IReport {
  _id: string;
  task: string;
  baseId: string;
  files: string[]; // Основные фото
  fixedFiles: string[]; // Исправленные/дополнительные фото
  issues: string[]; // Текущие замечания
  status: string; // Текущий статус ('Pending', 'Agreed', 'Fixed', 'Issues', ...)

  createdAt: Date; // Дата создания отчёта
  userId: string; // ID пользователя, создавшего отчёт (Clerk user ID)
  userName: string; // Имя пользователя (можно использовать из Clerk)

  events: IEvent[]; // История изменений
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
  userAvatar: string; // URL аватара из Clerk
  createdAt: string;
  baseStatuses: BaseStatus[];
}

export interface ApiResponse {
  reports: ReportClient[];
  error?: string;
}

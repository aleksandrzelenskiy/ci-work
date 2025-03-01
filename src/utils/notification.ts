// utils/notification.ts

import { sendEmail, SendEmailOptions } from './mailer';

// Определяем типы для различных деталей событий
export interface ReportCreatedDetails {
  fileCount: number;
}

export interface StatusChangedDetails {
  oldStatus: string;
  newStatus: string;
}

export interface IssuesUpdatedDetails {
  oldIssues: string[];
  newIssues: string[];
}

export interface FixedPhotosDetails {
  fileCount: number;
}

// Определяем интерфейсы для различных типов событий
export interface ReportCreatedEvent {
  action: 'REPORT_CREATED';
  author: string;
  authorId: string;
  date: Date;
  details: ReportCreatedDetails;
}

export interface StatusChangedEvent {
  action: 'STATUS_CHANGED';
  author: string;
  authorId: string;
  date: Date;
  details: StatusChangedDetails;
}

export interface IssuesUpdatedEvent {
  action: 'ISSUES_UPDATED';
  author: string;
  authorId: string;
  date: Date;
  details: IssuesUpdatedDetails;
}

export interface FixedPhotosEvent {
  action: 'FIXED_PHOTOS';
  author: string;
  authorId: string;
  date: Date;
  details: FixedPhotosDetails;
}

// Объединение всех типов событий
export type Event =
  | ReportCreatedEvent
  | StatusChangedEvent
  | IssuesUpdatedEvent
  | FixedPhotosEvent;

// Интерфейс для отчёта
export interface Report {
  task: string;
  baseId: string;
  // Добавьте другие необходимые поля, если они нужны для уведомлений
}

/**
 * Функция для отправки уведомления по электронной почте на основе события и отчета.
 * @param event Объект события.
 * @param report Объект отчета.
 */
export async function sendEventNotification(event: Event, report: Report) {
  const to = 'bigmount@yandex.ru'; // Временный фиксированный email

  let subject = '';
  let text = '';
  let html = '';

  switch (event.action) {
    case 'REPORT_CREATED':
      subject = `Новый отчет создан: ${report.task}`;
      text = `Здравствуйте,

Создан новый отчет.

Задача: ${report.task}
Базовый ID: ${report.baseId}
Автор: ${event.author}
Дата: ${event.date}

Количество файлов: ${event.details.fileCount}

С уважением,
CI Work`;
      html = `<p>Здравствуйте,</p>
<p>Создан новый отчет.</p>
<ul>
  <li><strong>Задача:</strong> ${report.task}</li>
  <li><strong>Базовый ID:</strong> ${report.baseId}</li>
  <li><strong>Автор:</strong> ${event.author}</li>
  <li><strong>Дата:</strong> ${event.date}</li>
</ul>
<p><strong>Количество файлов:</strong> ${event.details.fileCount}</p>
<p>С уважением,<br/>CI Work</p>`;
      break;

    case 'STATUS_CHANGED':
      subject = `Статус отчета изменен: ${report.task}`;
      text = `Здравствуйте,

Статус отчета "${report.task}" изменен.

Старый статус: ${event.details.oldStatus}
Новый статус: ${event.details.newStatus}
Автор: ${event.author}
Дата: ${event.date}

С уважением,
CI Work`;
      html = `<p>Здравствуйте,</p>
<p>Статус отчета "<strong>${report.task}</strong>" изменен.</p>
<ul>
  <li><strong>Старый статус:</strong> ${event.details.oldStatus}</li>
  <li><strong>Новый статус:</strong> ${event.details.newStatus}</li>
  <li><strong>Автор:</strong> ${event.author}</li>
  <li><strong>Дата:</strong> ${event.date}</li>
</ul>
<p>С уважением,<br/>CI Work</p>`;
      break;

    case 'ISSUES_UPDATED':
      subject = `Замечания обновлены: ${report.task}`;
      text = `Здравствуйте,

Замечания для отчета "${report.task}" были обновлены.

Старые замечания: ${event.details.oldIssues.join(', ')}
Новые замечания: ${event.details.newIssues.join(', ')}

Автор: ${event.author}
Дата: ${event.date}

С уважением,
CI Work`;
      html = `<p>Здравствуйте,</p>
<p>Замечания для отчета "<strong>${report.task}</strong>" были обновлены.</p>
<ul>
  <li><strong>Старые замечания:</strong> ${event.details.oldIssues.join(
    ', '
  )}</li>
  <li><strong>Новые замечания:</strong> ${event.details.newIssues.join(
    ', '
  )}</li>
</ul>
<p><strong>Автор:</strong> ${event.author}<br/>
<strong>Дата:</strong> ${event.date}</p>
<p>С уважением,<br/>CI Work</p>`;
      break;

    case 'FIXED_PHOTOS':
      subject = `Исправленные фото загружены: ${report.task}`;
      text = `Здравствуйте,

Исправленные фото были загружены для отчета "${report.task}".

Количество исправленных фото: ${event.details.fileCount}

Автор: ${event.author}
Дата: ${event.date}

С уважением,
CI Work`;
      html = `<p>Здравствуйте,</p>
<p>Исправленные фото были загружены для отчета "<strong>${report.task}</strong>".</p>
<ul>
  <li><strong>Количество исправленных фото:</strong> ${event.details.fileCount}</li>
  <li><strong>Автор:</strong> ${event.author}</li>
  <li><strong>Дата:</strong> ${event.date}</li>
</ul>
<p>С уважением,<br/>CI Work</p>`;
      break;
  }

  const emailOptions: SendEmailOptions = {
    to,
    subject,
    text,
    html,
  };

  await sendEmail(emailOptions);
}

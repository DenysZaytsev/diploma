// src/utils/translations.ts

export const statusTranslations: Record<string, string> = {
  'draft': 'Чернетка',
  'on_approval': 'На погодженні',
  'on_signing': 'На підписанні',
  'signed': 'Підписано',
  'rejected': 'Відхилено',
  'archived': 'В архіві'
};

export const directionTranslations: Record<string, string> = {
  'incoming': 'Вхідний',
  'outgoing': 'Вихідний',
  'internal': 'Внутрішній'
};

export const roleTranslations: Record<string, string> = {
  'admin': 'Адміністратор',
  'approver': 'Керівник',
  'signatory': 'Підписант',
  'employee': 'Працівник'
};

export const auditActionTranslations: Record<string, string> = {
  'create': 'Створення документа',
  'update': 'Редагування даних',
  'status_change': 'Зміна статусу',
  'comment': 'Додано коментар',
  'file_upload': 'Завантаження файлів',
  'file_delete': 'Видалення файлу',
  'delete': 'Видалення документа',
  'archive': 'Архівування',
  'link_related': 'Пов\'язано з документом',
  'unlink_related': 'Розірвано зв\'язок'
};

export const translateStatus = (status: string) => statusTranslations[status] || status;
export const translateDirection = (direction: string) => directionTranslations[direction] || direction;
export const translateRole = (role: string) => roleTranslations[role] || role;
export const translateAuditAction = (action: string) => auditActionTranslations[action] || action;

export const confidentialityTranslations: Record<string, string> = {
  'public': 'Публічний',
  'internal': 'Внутрішній (доступно компанії)',
  'confidential': 'Конфіденційний',
  'secret': 'Таємний'
};
export const translateConfidentiality = (level: string) => confidentialityTranslations[level] || level;

/**
 * Статусы сущностей платформы u7-school.
 * - DRAFT: черновик, виден только автору
 * - PUBLISHED: опубликован, виден всем
 * - ARCHIVED: архивирован, виден только автору и администраторам
 */
export enum Status {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

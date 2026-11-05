/**
 * Статусы учебного потока.
 * - ENROLLMENT: открыта регистрация студентов
 * - ACTIVE: поток запущен, идёт процесс обучения
 * - COMPLETED: поток успешно завершён
 * - ARCHIVED: поток заархивирован
 */
export enum StreamStatus {
  ENROLLMENT = 'enrollment',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

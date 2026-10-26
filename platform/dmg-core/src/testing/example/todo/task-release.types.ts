import type { TaskAr } from './task/task.ar';

/**
 * Итог освобождения задач удалённого пользователя: какие задачи изменены
 * и как. Вызывающий (ER) регистрирует в UoW обе группы.
 */
export type TaskRelease = {
  /** Задачи пользователя — ушли в архив. */
  readonly archived: readonly TaskAr[];
  /** Чужие задачи, назначенные пользователю, — вернулись владельцам. */
  readonly unassigned: readonly TaskAr[];
};

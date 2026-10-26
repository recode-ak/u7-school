import type { ErrorOf } from '#core/kernel/errors/define-errors';
import { ok, type Result } from '#core/kernel/result/result';
import type { Timestamp } from '#core/kernel/time/timestamp';
import type { TaskAr } from './task/task.ar';
import type { TaskErrors } from './task/task.errors';
import type { TaskRelease } from './task-release.types';

/**
 * Освобождение задач удалённого пользователя — мутация нескольких задач
 * одной операцией (DOM-06): свои задачи уходят в архив, чужие задачи,
 * назначенные ему, возвращаются владельцам. Что с задачей делать, отвечает
 * каждый `TaskAr` (`isOwnedBy`, `isAssignedTo`, `isArchived`); сервис не
 * верит выборке вызывающего и только применяет ответы.
 */
export class TaskReleaseDcs {
  constructor(
    private readonly userId: string,
    private readonly tasks: readonly TaskAr[],
  ) {}

  /**
   * Освобождает задачи и возвращает изменённые. Архивные и чужие не
   * меняются, поэтому повторное событие ничего не пишет.
   */
  release(
    at: Timestamp,
  ): Result<TaskRelease, ErrorOf<typeof TaskErrors.ARCHIVED>> {
    const archived: TaskAr[] = [];
    const unassigned: TaskAr[] = [];
    for (const task of this.tasks) {
      if (task.isArchived()) continue;
      if (task.isOwnedBy(this.userId)) {
        const res = task.archive(at);
        if (!res.ok) return res;
        archived.push(task);
      } else if (task.isAssignedTo(this.userId)) {
        const res = task.unassign(at);
        if (!res.ok) return res;
        unassigned.push(task);
      }
    }
    return ok({ archived, unassigned });
  }
}

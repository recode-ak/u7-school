import {
  type ReactionEnvelopeOf,
  ReactionFromDef,
} from '#core/app/reaction/reaction-from-def';
import type { UnitOfWork } from '#core/app/uow/unit-of-work';
import { ok } from '#core/kernel/result/result';
import type { TodoDeps } from '#core/testing/example/app/todo/todo.module';
import {
  ReleaseRemovedUserTasksErDef,
  TaskReleaseDcs,
  type TodoModuleDef,
} from '#core/testing/example/todo/index';

type Def = typeof ReleaseRemovedUserTasksErDef;

/**
 * Освобождает задачи удалённого пользователя: загружает задачи с его
 * участием (владелец или исполнитель) одной выборкой репозитория,
 * решение — `TaskReleaseDcs`, ER регистрирует изменённые.
 */
export class ReleaseRemovedUserTasksEr extends ReactionFromDef<Def, TodoDeps> {
  constructor(deps: TodoDeps, module: typeof TodoModuleDef) {
    super(ReleaseRemovedUserTasksErDef, deps, module);
  }

  protected async react(event: ReactionEnvelopeOf<Def>, uow: UnitOfWork) {
    const { userId } = event.payload;
    const tasks = await this.resolve.tasks.findActiveByParticipant(userId);
    const released = new TaskReleaseDcs(userId, tasks).release(this.now());
    if (!released.ok) return released;
    const { archived, unassigned } = released.value;
    for (const task of [...archived, ...unassigned]) {
      uow.register(task, this.resolve.tasks);
    }
    return ok();
  }
}

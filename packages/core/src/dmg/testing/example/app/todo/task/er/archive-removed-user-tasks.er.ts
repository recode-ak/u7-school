import {
  type ReactionEnvelopeOf,
  ReactionFromDef,
} from '#dmg/app/reaction/reaction-from-def';
import type { UnitOfWork } from '#dmg/app/uow/unit-of-work';
import { ok } from '#dmg/kernel/result/result';
import type { TodoDeps } from '#dmg/testing/example/app/todo/todo.module';
import { ArchiveRemovedUserTasksErDef } from '#dmg/testing/example/todo/index';

type Def = typeof ArchiveRemovedUserTasksErDef;

export class ArchiveRemovedUserTasksEr extends ReactionFromDef<Def, TodoDeps> {
  constructor(deps: TodoDeps) {
    super(ArchiveRemovedUserTasksErDef, deps);
  }

  protected async react(event: ReactionEnvelopeOf<Def>, uow: UnitOfWork) {
    const { tasks } = this.resolve;
    for (const task of await tasks.findActiveByOwner(event.payload.userId)) {
      const res = task.archive();
      if (!res.ok) return res;
      uow.register(task, tasks);
    }
    return ok();
  }
}

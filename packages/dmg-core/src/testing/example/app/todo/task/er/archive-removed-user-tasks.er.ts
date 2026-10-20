import {
  type ReactionEnvelopeOf,
  ReactionFromDef,
} from '#core/app/reaction/reaction-from-def';
import type { UnitOfWork } from '#core/app/uow/unit-of-work';
import { ok } from '#core/kernel/result/result';
import type { TodoDeps } from '#core/testing/example/app/todo/todo.module';
import { ArchiveRemovedUserTasksErDef } from '#core/testing/example/todo/index';

type Def = typeof ArchiveRemovedUserTasksErDef;

export class ArchiveRemovedUserTasksEr extends ReactionFromDef<Def, TodoDeps> {
  constructor(deps: TodoDeps) {
    super(ArchiveRemovedUserTasksErDef, deps);
  }

  protected async react(event: ReactionEnvelopeOf<Def>, uow: UnitOfWork) {
    const { tasks } = this.resolve;
    for (const task of await tasks.findActiveByOwner(event.payload.userId)) {
      const res = task.archive(this.now());
      if (!res.ok) return res;
      uow.register(task, tasks);
    }
    return ok();
  }
}

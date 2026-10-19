import {
  type ReactionEnvelopeOf,
  ReactionFromDef,
} from '../../../../../../app/reaction/reaction-from-def';
import type { UnitOfWork } from '../../../../../../app/uow/unit-of-work';
import { ok } from '../../../../../../kernel/result/result';
import { ArchiveRemovedUserTasksErDef } from '../../../../todo';
import type { TodoDeps } from '../../todo.module';

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

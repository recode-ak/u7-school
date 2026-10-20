import type { UnitOfWork } from '#core/app/uow/unit-of-work';
import { UseCaseFromDef } from '#core/app/use-case/use-case-from-def';
import { ok } from '#core/kernel/result/result';
import type { ExampleUser } from '#core/testing/example/app/app-user';
import type { TodoDeps } from '#core/testing/example/app/todo/todo.module';
import {
  CompleteTaskUcDef,
  type TaskAr,
  TaskErrors,
} from '#core/testing/example/todo/index';

type Loaded = { readonly task: TaskAr };

export class CompleteTaskUc extends UseCaseFromDef<
  typeof CompleteTaskUcDef,
  TodoDeps,
  Loaded,
  ExampleUser
> {
  constructor(deps: TodoDeps) {
    super(CompleteTaskUcDef, deps);
  }

  protected async load({ taskId }: { taskId: string }) {
    const task = await this.resolve.tasks.findById(taskId);
    return task ? ok({ task }) : TaskErrors.NOT_FOUND.err({ taskId });
  }

  protected async execute(_: unknown, { task }: Loaded, uow: UnitOfWork) {
    const res = task.complete();
    if (!res.ok) return res;
    uow.register(task, this.resolve.tasks);
    return ok({});
  }
}

import type { UnitOfWork } from '#core/app/uow/unit-of-work';
import { UseCaseFromDef } from '#core/app/use-case/use-case-from-def';
import type { Caller } from '#core/kernel/caller/caller';
import { ok } from '#core/kernel/result/result';
import type { ExampleUser } from '#core/testing/example/app/app-user';
import type { TodoDeps } from '#core/testing/example/app/todo/todo.module';
import {
  CreateTaskUcDef,
  TaskAr,
  TodoModuleDef,
} from '#core/testing/example/todo/index';

/** Задачи владельца — контекст правила предела открытых задач. */
type Loaded = { readonly ownerTasks: readonly TaskAr[] };

export class CreateTaskUc extends UseCaseFromDef<
  typeof CreateTaskUcDef,
  TodoDeps,
  Loaded,
  ExampleUser
> {
  constructor(deps: TodoDeps) {
    super(CreateTaskUcDef, deps, TodoModuleDef);
  }

  protected async load(_: unknown, caller: Caller<ExampleUser>) {
    const ownerId = this.subject(caller).uuid;
    return ok({
      ownerTasks: await this.resolve.tasks.findActiveByOwner(ownerId),
    });
  }

  protected async execute(
    input: { title: string },
    _: Loaded,
    uow: UnitOfWork,
    caller: Caller<ExampleUser>,
  ) {
    const created = TaskAr.create(
      {
        uuid: crypto.randomUUID(),
        ownerId: this.subject(caller).uuid,
        title: input.title,
      },
      this.now(),
    );
    if (!created.ok) return created;
    uow.register(created.value, this.resolve.tasks);
    return ok({ taskId: created.value.uuid });
  }
}

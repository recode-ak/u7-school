import type { UnitOfWork } from '#core/app/uow/unit-of-work';
import { UseCaseFromDef } from '#core/app/use-case/use-case-from-def';
import type { Caller } from '#core/kernel/caller/caller';
import { ok } from '#core/kernel/result/result';
import type { ExampleUser } from '#core/testing/example/app/app-user';
import type { TodoDeps } from '#core/testing/example/app/todo/todo.module';
import { CreateTaskUcDef, TaskAr } from '#core/testing/example/todo/index';

export class CreateTaskUc extends UseCaseFromDef<
  typeof CreateTaskUcDef,
  TodoDeps,
  undefined,
  ExampleUser
> {
  constructor(deps: TodoDeps) {
    super(CreateTaskUcDef, deps);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute(
    input: { title: string },
    _: undefined,
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

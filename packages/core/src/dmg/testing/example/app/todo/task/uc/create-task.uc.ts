import type { UnitOfWork } from '#dmg/app/uow/unit-of-work';
import { UseCaseFromDef } from '#dmg/app/use-case/use-case-from-def';
import type { Caller } from '#dmg/kernel/caller/caller';
import { ok } from '#dmg/kernel/result/result';
import type { ExampleUser } from '#dmg/testing/example/app/app-user';
import type { TodoDeps } from '#dmg/testing/example/app/todo/todo.module';
import { CreateTaskUcDef, TaskAr } from '#dmg/testing/example/todo/index';

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
    const created = TaskAr.create({
      uuid: crypto.randomUUID(),
      ownerId: this.subject(caller).uuid,
      title: input.title,
    });
    if (!created.ok) return created;
    uow.register(created.value, this.resolve.tasks);
    return ok({ taskId: created.value.uuid });
  }
}

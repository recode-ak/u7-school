import type { UnitOfWork } from '#dmg/app/uow/unit-of-work';
import { UseCaseFromDef } from '#dmg/app/use-case/use-case-from-def';
import type { Caller } from '#dmg/kernel/caller/caller';
import { ok } from '#dmg/kernel/result/result';
import type { ExampleUser } from '#dmg/testing/example/app/app-user';
import type { TodoDeps } from '#dmg/testing/example/app/todo/todo.module';
import { ListTasksUcDef } from '#dmg/testing/example/todo/index';

export class ListTasksUc extends UseCaseFromDef<
  typeof ListTasksUcDef,
  TodoDeps,
  undefined,
  ExampleUser
> {
  constructor(deps: TodoDeps) {
    super(ListTasksUcDef, deps);
  }

  protected async load() {
    return ok(undefined);
  }

  /** Выход — снапшоты: лишние поля отбрасывает схема output (`v.pick`). */
  protected async execute(
    _: unknown,
    __: undefined,
    ___: UnitOfWork,
    caller: Caller<ExampleUser>,
  ) {
    const owner = this.subject(caller).uuid;
    const tasks = await this.resolve.tasks.findActiveByOwner(owner);
    return ok(tasks.map((task) => task.snapshot()));
  }
}

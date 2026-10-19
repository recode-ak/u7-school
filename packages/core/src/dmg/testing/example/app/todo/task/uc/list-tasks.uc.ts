import type { UnitOfWork } from '../../../../../../app/uow/unit-of-work';
import { UseCaseFromDef } from '../../../../../../app/use-case/use-case-from-def';
import type { Caller } from '../../../../../../kernel/caller/caller';
import { ok } from '../../../../../../kernel/result/result';
import { ListTasksUcDef } from '../../../../todo';
import type { ExampleUser } from '../../../app-user';
import type { TodoDeps } from '../../todo.module';

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

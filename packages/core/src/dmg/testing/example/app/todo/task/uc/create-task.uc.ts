import type { UnitOfWork } from '../../../../../../app/uow/unit-of-work';
import { UseCaseFromDef } from '../../../../../../app/use-case/use-case-from-def';
import type { Caller } from '../../../../../../kernel/caller/caller';
import { ok } from '../../../../../../kernel/result/result';
import { CreateTaskUcDef, TaskAr } from '../../../../todo';
import type { ExampleUser } from '../../../app-user';
import type { TodoDeps } from '../../todo.module';

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

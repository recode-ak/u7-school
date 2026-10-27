import type { UnitOfWork } from '#core/app/uow/unit-of-work';
import { UseCaseFromDef } from '#core/app/use-case/use-case-from-def';
import type { Caller } from '#core/kernel/caller/caller';
import { ok } from '#core/kernel/result/result';
import type { Trace } from '#core/kernel/trace/trace';
import type { TodoDeps } from '#core/testing/example/app/todo/todo.module';
import type { ExampleUser } from '#core/testing/example/shared/app-user';
import {
  AssignTaskUcDef,
  type TaskAr,
  TaskErrors,
  type TodoModuleDef,
} from '#core/testing/example/todo/index';
import {
  GetUserUcDef,
  type UserActivity,
} from '#core/testing/example/users/contract';

type Input = { readonly taskId: string; readonly assigneeId: string };

/** Контекст Policy `canManage` и правила `assigneeActive`. */
type Loaded = { readonly task: TaskAr; readonly assignee: UserActivity };

/**
 * Назначение исполнителя: `load` кладёт задачу и ответ `users` в контекст
 * Policy и правила `assigneeActive`, `execute` — переход `TaskAr.assign`.
 * Решений по ответу `users` в UC нет (API-01).
 */
export class AssignTaskUc extends UseCaseFromDef<
  typeof AssignTaskUcDef,
  TodoDeps,
  Loaded,
  ExampleUser
> {
  constructor(deps: TodoDeps, module: typeof TodoModuleDef) {
    super(AssignTaskUcDef, deps, module);
  }

  /** Задача — из репозитория, исполнитель — ответ `users` через фасад. */
  protected async load(
    { taskId, assigneeId }: Input,
    caller: Caller<ExampleUser>,
    trace: Trace,
  ) {
    const task = await this.resolve.tasks.findById(taskId);
    if (!task) return TaskErrors.NOT_FOUND.err({ taskId });
    const assignee = await this.call(
      GetUserUcDef,
      { userId: assigneeId },
      caller,
      trace,
    );
    if (!assignee.ok) return assignee;
    return ok({ task, assignee: assignee.value });
  }

  protected async execute(
    { assigneeId }: Input,
    { task }: Loaded,
    uow: UnitOfWork,
  ) {
    const res = task.assign(assigneeId, this.now());
    if (!res.ok) return res;
    uow.register(task, this.resolve.tasks);
    return ok({});
  }
}

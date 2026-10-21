import type { UnitOfWork } from '#core/app/uow/unit-of-work';
import { UseCaseFromDef } from '#core/app/use-case/use-case-from-def';
import { ok } from '#core/kernel/result/result';
import type { TodoDeps } from '#core/testing/example/app/todo/todo.module';
import {
  GetTaskUcDef,
  type TaskAr,
  TaskErrors,
  type TodoModuleDef,
} from '#core/testing/example/todo/index';

type Loaded = { readonly task: TaskAr };

/** Задача для фасада: Policy `canManage` — по субъекту `origin` (D-42). */
export class GetTaskUc extends UseCaseFromDef<
  typeof GetTaskUcDef,
  TodoDeps,
  Loaded
> {
  constructor(deps: TodoDeps, module: typeof TodoModuleDef) {
    super(GetTaskUcDef, deps, module);
  }

  protected async load({ taskId }: { taskId: string }) {
    const task = await this.resolve.tasks.findById(taskId);
    return task ? ok({ task }) : TaskErrors.NOT_FOUND.err({ taskId });
  }

  /** Выход — state агрегата: фасад вернёт его как `ReadonlyAr`. */
  protected async execute(_: unknown, { task }: Loaded, __: UnitOfWork) {
    return ok(task.snapshot());
  }
}

import {
  JobFromDef,
  type JobReport,
  type JobRun,
} from '#core/app/job/job-from-def';
import type { UnitOfWork } from '#core/app/uow/unit-of-work';
import { ok } from '#core/kernel/result/result';
import type { TodoDeps } from '#core/testing/example/app/todo/todo.module';
import {
  ArchiveDoneTasksJobDef,
  type TaskAr,
  type TodoModuleDef,
} from '#core/testing/example/todo/index';

export class ArchiveDoneTasksJob extends JobFromDef<
  typeof ArchiveDoneTasksJobDef,
  TodoDeps
> {
  constructor(deps: TodoDeps, module: typeof TodoModuleDef) {
    super(ArchiveDoneTasksJobDef, deps, module);
  }

  protected async run(job: JobRun): Promise<JobReport> {
    const done = await this.resolve.tasks.findDone();
    return job.forEach(done, (task, uow) => this.archive(task, uow));
  }

  private async archive(task: TaskAr, uow: UnitOfWork) {
    const res = task.archive(this.now());
    if (!res.ok) return res;
    uow.register(task, this.resolve.tasks);
    return ok();
  }
}

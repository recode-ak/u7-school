import {
  JobFromDef,
  type JobReport,
  type JobRun,
} from '#dmg/app/job/job-from-def';
import type { UnitOfWork } from '#dmg/app/uow/unit-of-work';
import { ok } from '#dmg/kernel/result/result';
import type { TodoDeps } from '#dmg/testing/example/app/todo/todo.module';
import {
  ArchiveDoneTasksJobDef,
  type TaskAr,
} from '#dmg/testing/example/todo/index';

export class ArchiveDoneTasksJob extends JobFromDef<
  typeof ArchiveDoneTasksJobDef,
  TodoDeps
> {
  constructor(deps: TodoDeps) {
    super(ArchiveDoneTasksJobDef, deps);
  }

  protected async run(job: JobRun): Promise<JobReport> {
    const done = await this.resolve.tasks.findDone();
    return job.forEach(done, (task, uow) => this.archive(task, uow));
  }

  private async archive(task: TaskAr, uow: UnitOfWork) {
    const res = task.archive();
    if (!res.ok) return res;
    uow.register(task, this.resolve.tasks);
    return ok();
  }
}

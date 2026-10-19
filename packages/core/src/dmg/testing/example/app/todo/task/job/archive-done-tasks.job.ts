import {
  JobFromDef,
  type JobReport,
} from '../../../../../../app/job/job-from-def';
import type { UnitOfWork } from '../../../../../../app/uow/unit-of-work';
import { ok } from '../../../../../../kernel/result/result';
import { ArchiveDoneTasksJobDef, type TaskAr } from '../../../../todo';
import type { TodoDeps } from '../../todo.module';

export class ArchiveDoneTasksJob extends JobFromDef<
  typeof ArchiveDoneTasksJobDef,
  TodoDeps
> {
  constructor(deps: TodoDeps) {
    super(ArchiveDoneTasksJobDef, deps);
  }

  protected async run(): Promise<JobReport> {
    const done = await this.resolve.tasks.findDone();
    return this.forEach(done, (task, uow) => this.archive(task, uow));
  }

  private async archive(task: TaskAr, uow: UnitOfWork) {
    const res = task.archive();
    if (!res.ok) return res;
    uow.register(task, this.resolve.tasks);
    return ok();
  }
}

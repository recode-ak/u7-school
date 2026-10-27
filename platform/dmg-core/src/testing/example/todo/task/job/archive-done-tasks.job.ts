import { JobDef } from '#core/domain/contracts/job-def';
import { TaskArDef } from '../task.ar';
import { TaskEvents } from '../task.events';

export const ArchiveDoneTasksJobDef = JobDef.define({
  name: 'archiveDoneTasks',
  label: 'Архивировать выполненные задачи',
  description: 'Раз в сутки убирает выполненные задачи в архив.',
  schedule: { kind: 'dailyAt', hour: 3, minute: 0 },
  scans: [TaskArDef],
  emits: [TaskEvents.archived],
});

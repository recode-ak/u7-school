import { defineJob } from '../../../../../domain/contracts/define-job';
import { TaskDef } from '../task.ar';
import { TaskEvents } from '../task.events';

export const ArchiveDoneTasksJob = defineJob({
  name: 'archiveDoneTasks',
  label: 'Архивировать выполненные задачи',
  description: 'Раз в сутки убирает выполненные задачи в архив.',
  schedule: { kind: 'dailyAt', hour: 3, minute: 0 },
  scans: [TaskDef],
  emits: [TaskEvents.archived],
});

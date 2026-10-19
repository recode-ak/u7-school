import { defineEventReaction } from '../../../../../domain/contracts/define-event-reaction';
import { UserEvents } from '../../../users/user/user.ar';
import { TaskArDef } from '../task.ar';
import { TaskEvents } from '../task.events';

export const ArchiveRemovedUserTasksErDef = defineEventReaction({
  name: 'archiveRemovedUserTasks',
  label: 'Архивировать задачи удалённого пользователя',
  description: 'Когда пользователь удалён, все его задачи уходят в архив.',
  on: [UserEvents.removed],
  touches: [TaskArDef],
  emits: [TaskEvents.archived],
});

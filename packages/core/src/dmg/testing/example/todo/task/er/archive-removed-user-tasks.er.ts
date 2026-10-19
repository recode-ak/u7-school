import { defineEventReaction } from '../../../../../domain/contracts/define-event-reaction';
import { UserEvents } from '../../../users/user/user.ar';
import { TaskDef } from '../task.ar';
import { TaskEvents } from '../task.events';

export const ArchiveRemovedUserTasksEr = defineEventReaction({
  name: 'archiveRemovedUserTasks',
  label: 'Архивировать задачи удалённого пользователя',
  description: 'Когда пользователь удалён, все его задачи уходят в архив.',
  on: [UserEvents.removed],
  touches: [TaskDef],
  emits: [TaskEvents.archived],
});

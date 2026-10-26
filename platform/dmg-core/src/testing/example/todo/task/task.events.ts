import * as v from 'valibot';
import { defineEvents } from '#core/domain/events/define-events';
import { F } from '#core/kernel/fields/fields';

const ref = {
  taskId: F.uuid('задачи'),
  ownerId: F.uuid('владельца'),
};

const assignment = v.object({ ...ref, assigneeId: F.uuid('исполнителя') });

export const TaskEvents = defineEvents('todo.task', {
  created: {
    label: 'Задача создана',
    description: 'Пользователь добавил задачу в свой список.',
    payload: v.object({ ...ref, title: F.string('Название задачи') }),
  },
  completed: {
    label: 'Задача выполнена',
    description: 'Задача отмечена выполненной.',
    payload: v.object(ref),
  },
  archived: {
    label: 'Задача в архиве',
    description: 'Задача убрана в архив и больше не меняется.',
    payload: v.object(ref),
  },
  // Назначение не меняет статус: событие порождает `change`, а не переход.
  assigned: {
    label: 'Задача назначена',
    description: 'Открытой задаче назначен исполнитель.',
    payload: assignment,
  },
  unassigned: {
    label: 'Назначение снято',
    description: 'С задачи снят исполнитель, которому она была назначена.',
    payload: assignment,
  },
});

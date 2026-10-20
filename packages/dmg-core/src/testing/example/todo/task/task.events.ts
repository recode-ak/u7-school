import * as v from 'valibot';
import { defineEvents } from '#core/domain/events/define-events';
import { F } from '#core/kernel/fields/fields';

const ref = {
  taskId: F.uuid('задачи'),
  ownerId: F.uuid('владельца'),
};

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
});

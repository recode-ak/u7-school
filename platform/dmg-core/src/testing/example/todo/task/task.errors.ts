import * as v from 'valibot';
import { ErrorDef } from '#core/kernel/errors/error-def';
import { F } from '#core/kernel/fields/fields';

export const TaskErrors = ErrorDef.define('TASK', {
  NOT_FOUND: {
    kind: 'not_found',
    label: 'Задача не найдена',
    description: 'Задачи с таким идентификатором нет.',
    payload: v.object({ taskId: F.uuid('задачи') }),
  },
  ALREADY_DONE: {
    kind: 'conflict',
    label: 'Задача уже выполнена',
    description: 'Выполненную задачу нельзя выполнить повторно.',
  },
  ARCHIVED: {
    kind: 'conflict',
    label: 'Задача в архиве',
    description: 'Архивную задачу нельзя менять.',
  },
  TOO_MANY_OPEN: {
    kind: 'conflict',
    label: 'Слишком много открытых задач',
    description: 'Новую задачу нельзя создать, пока открытых задач — предел.',
    payload: v.object({ limit: F.int('Предел открытых задач') }),
  },
  NOT_ASSIGNABLE: {
    kind: 'conflict',
    label: 'Задачу нельзя назначить',
    description: 'Назначить исполнителя можно только открытой задаче.',
  },
  // Своя ошибка, а не USER_*: смысл другой — пользователь есть, но
  // исполнителем быть не может (ERR-03).
  ASSIGNEE_INACTIVE: {
    kind: 'conflict',
    label: 'Исполнитель неактивен',
    description: 'Назначить задачу можно только активному пользователю.',
    payload: v.object({ assigneeId: F.uuid('исполнителя') }),
  },
});

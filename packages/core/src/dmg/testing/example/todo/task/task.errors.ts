import * as v from 'valibot';
import { defineErrors } from '../../../../kernel/errors/define-errors';
import { F } from '../../../../kernel/fields/fields';

export const TaskErrors = defineErrors('TASK', {
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
});

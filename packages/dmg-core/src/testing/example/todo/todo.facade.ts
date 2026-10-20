import type { ReadonlyAr } from '#core/domain/aggregate/readonly-ar';
import { defineFacade, method } from '#core/domain/contracts/define-facade';
import type { TaskAr } from './task/task.ar';
import { TaskErrors } from './task/task.errors';

export const TodoFacadeDef = defineFacade({
  name: 'todo',
  label: 'Задачи',
  description: 'Runtime-API модуля задач для других модулей.',
  methods: {
    getTask: method<[taskId: string], ReadonlyAr<TaskAr>>()({
      label: 'Задача',
      description: 'Задача по идентификатору — только для чтения.',
      errors: [TaskErrors.NOT_FOUND],
    }),
  },
});

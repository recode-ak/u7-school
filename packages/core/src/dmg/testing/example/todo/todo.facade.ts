import type { ReadonlyAr } from '#dmg/domain/aggregate/readonly-ar';
import { defineFacade, method } from '#dmg/domain/contracts/define-facade';
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

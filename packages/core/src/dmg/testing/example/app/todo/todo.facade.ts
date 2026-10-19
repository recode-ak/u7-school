import { implementFacade } from '../../../../app/facade/implement-facade';
import { ok } from '../../../../kernel/result/result';
import { TaskErrors, TodoFacadeDef } from '../../todo';
import type { TodoDeps } from './todo.module';

/** In-proc реализация фасада: задача только для чтения (API-04). */
export function todoFacade(deps: TodoDeps) {
  return implementFacade(TodoFacadeDef, {
    getTask: async (taskId) => {
      const task = await deps.tasks.findById(taskId);
      return task ? ok(task) : TaskErrors.NOT_FOUND.err({ taskId });
    },
  });
}

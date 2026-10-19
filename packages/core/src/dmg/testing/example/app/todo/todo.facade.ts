import { implementFacade } from '../../../../app/facade/implement-facade';
import { ok } from '../../../../kernel/result/result';
import { TaskErrors, TodoFacadeDef } from '../../todo';
import type { TodoDeps } from './todo.module';

/**
 * In-proc реализация фасада: задача только для чтения (API-04).
 *
 * В примере фасад никто не потребляет: `users` — заглушка без реализации.
 * В реальности модуль-потребитель (тот, у кого `todo` в `dependsOn` и
 * `TodoFacadeDef` в `calls` своих ER) получает фасад в своём резолвере как
 * `FacadeApi<typeof TodoFacadeDef>`, а сборка приложения передаёт туда
 * `todoModule.facade`. Для этого `ModuleFromDef.facade` придётся
 * типизировать по `M['facade']` — сделаем при переводе `wish` на DMG.
 */
export function todoFacade(deps: TodoDeps) {
  return implementFacade(TodoFacadeDef, {
    getTask: async (taskId) => {
      const task = await deps.tasks.findById(taskId);
      return task ? ok(task) : TaskErrors.NOT_FOUND.err({ taskId });
    },
  });
}

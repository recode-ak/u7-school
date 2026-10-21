import { asReadonlyAr } from '#core/app/facade/as-readonly-ar';
import { callUseCase, type UseCaseOwner } from '#core/app/facade/call-use-case';
import {
  GetTaskUcDef,
  TaskAr,
  type TodoFacade,
  type TodoModuleDef,
} from '#core/testing/example/todo/index';

/**
 * In-proc реализация фасада todo (D-42, API-04): каждый метод — вызов UC
 * модуля от `SystemCaller` потребителя, выход-state — `ReadonlyAr`. Доменных
 * решений нет. Приложение собирает фасад поверх модуля и передаёт его в
 * резолвер модуля-потребителя (у того `todo` в `dependsOn`, UC — в `calls`).
 */
export function todoFacade(
  todo: UseCaseOwner<typeof TodoModuleDef>,
): TodoFacade {
  return {
    getTask: async (call, taskId) =>
      asReadonlyAr(
        TaskAr,
        await callUseCase(todo, GetTaskUcDef, { taskId }, call),
      ),
  };
}

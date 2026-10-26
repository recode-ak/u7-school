/**
 * Контракт модуля todo (D-45) — вход для остального кода: паспорт модуля,
 * Def UC, события и ошибки. Ar, Policy, DCS, ArDef и схемы entity сюда не
 * входят: их видят только домен и прикладной слой модуля (`index.ts`).
 */

/** Кто: вызывающие UC todo. Зачем: ветвление по коду отказа. */
export { TaskErrors } from './task/task.errors';
/** Кто: реакции других модулей и UI. Зачем: подписка по `TaskEvents.<e>.name`. */
export { TaskEvents } from './task/task.events';
/** Кто: транспорт (пользователь, делегат). Зачем: назначение исполнителя задаче. */
export { AssignTaskUcDef } from './task/uc/assign-task.uc';
/** Кто: транспорт. Зачем: отметить задачу выполненной. */
export { CompleteTaskUcDef } from './task/uc/complete-task.uc';
/** Кто: транспорт. Зачем: новая задача в списке вызывающего. */
export { CreateTaskUcDef } from './task/uc/create-task.uc';
/** Кто: другие модули через фасад todo (system). Зачем: задача целиком (D-42). */
export { GetTaskUcDef } from './task/uc/get-task.uc';
/** Кто: транспорт. Зачем: список задач вызывающего. */
export { ListTasksUcDef } from './task/uc/list-tasks.uc';
/** Кто: `dependsOn` других модулей и сборка приложения. Зачем: паспорт модуля. */
export { TodoModuleDef } from './todo.module';

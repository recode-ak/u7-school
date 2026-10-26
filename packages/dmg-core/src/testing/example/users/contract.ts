/**
 * Контракт модуля users (D-45) — вход для остального кода: паспорт модуля,
 * Def UC, события и ошибки. Ar, ArDef и схемы entity сюда не входят.
 */

/** Кто: UC других модулей через фасад (`todo.assignTask`). Зачем: активна ли учётная запись. */
export {
  GetUserUcDef,
  type UserActivity,
} from './user/uc/get-user.uc';
/** Кто: транспорт и сценарии приложения. Зачем: удаление учётной записи. */
export { RemoveUserUcDef } from './user/uc/remove-user.uc';
/** Кто: вызывающие `getUser`. Зачем: отказ «нет пользователя» берут по ссылке (ERR-03). */
export { UserErrors } from './user/user.errors';
/** Кто: реакции других модулей (`todo.releaseRemovedUserTasks`). Зачем: `on` по событию удаления. */
export { UserEvents } from './user/user.events';
/** Кто: `dependsOn` других модулей и сборка приложения. Зачем: паспорт модуля. */
export { UsersModuleDef } from './users.module';

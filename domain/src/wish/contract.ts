/**
 * Контракт модуля wish (D-45): паспорт модуля, Def UC, события и ошибки.
 * Ar, Policy, DCS, ArDef и схемы entity сюда не входят.
 */

/** Кто: stories бота (каталог курсов), `scripts/call-uc.ts`. Зачем: отмена желания. */
export { CancelWishUcDef } from './wish/uc/cancel-wish.uc';
/** Кто: stories бота, `scripts/call-uc.ts`. Зачем: фиксация желания пройти курс. */
export { CreateCourseWishUcDef } from './wish/uc/create-course-wish.uc';
/** Кто: stories бота, `scripts/call-uc.ts`. Зачем: фиксация желания пройти модуль. */
export { CreateModuleWishUcDef } from './wish/uc/create-module-wish.uc';
/** Кто: stories бота, `scripts/call-uc.ts`. Зачем: список желаний пользователя. */
export { ListUserWishesUcDef } from './wish/uc/list-user-wishes.uc';
export { WishErrors } from './wish/wish.errors';
export { WishEvents } from './wish/wish.events';
/** Кто: сборка приложения (`scripts/call-uc.ts`) и `dependsOn` других модулей. Зачем: паспорт модуля. */
export { WishModuleDef } from './wish.module';

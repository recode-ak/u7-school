/**
 * Контракт модуля wish: паспорт модуля, Def UC, события и ошибки;
 * Ar, Policy и DQS — по нужде зависимых (D-45, D-69).
 */

/** Кто: stories бота (каталог курсов), `scripts/call-uc.ts`. Зачем: отмена желания. */
export { CancelWishUcDef } from './wish/uc/cancel-wish.uc';
/** Кто: stories бота, `scripts/call-uc.ts`. Зачем: фиксация желания пройти курс. */
export { CreateCourseWishUcDef } from './wish/uc/create-course-wish.uc';
/** Кто: stories бота, `scripts/call-uc.ts`. Зачем: фиксация желания пройти модуль. */
export { CreateModuleWishUcDef } from './wish/uc/create-module-wish.uc';
/** Кто: stories бота, `scripts/call-uc.ts`. Зачем: список желаний пользователя. */
export { ListUserWishesUcDef } from './wish/uc/list-user-wishes.uc';
/**
 * Агрегат желания и выбор из загруженных: каталог курсов бота восстанавливает
 * `ReadonlyAr<WishAr>` из выхода `listUserWishes` (D-69) и выбирает текущее
 * желание на курс `WishSelectionDqs.current` (D-72).
 */
export { WishAr } from './wish/wish.ar';
export { WishErrors } from './wish/wish.errors';
export { WishEvents } from './wish/wish.events';
/** Кто: сборка приложения (`scripts/call-uc.ts`) и `dependsOn` других модулей. Зачем: паспорт модуля. */
export { WishModuleDef } from './wish.module';
export { WishSelectionDqs } from './wish-selection.dqs';

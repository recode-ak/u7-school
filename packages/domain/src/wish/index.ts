// Domain слой модуля wish (@u7-scl/domain/wish)
export * from './contract';
export * from './module';
export * from './state';
export * from './wish/commands/cancel-wish-cmd';
export * from './wish/commands/create-course-wish-cmd';
export * from './wish/commands/create-module-wish-cmd';
export * from './wish/commands/list-user-wishes-cmd';
export * from './wish/pools/course-pool';
export { CreateCourseWishUcDef } from './wish/uc/create-course-wish.uc';
export * from './wish/wish.ar';
export * from './wish/wish.policy';
export * from './wish/wish.rules';
export { WishModuleDef } from './wish.module';
// gen:exports

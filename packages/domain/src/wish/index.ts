// Domain слой модуля wish (@u7-scl/domain/wish)
export * from './contract';
export * from './module';
export * from './state';
export * from './wish/commands/cancel-wish-cmd';
export * from './wish/commands/create-course-wish-cmd';
export * from './wish/commands/create-module-wish-cmd';
export * from './wish/commands/list-user-wishes-cmd';
export { AbandonWishErDef } from './wish/er/abandon-wish.er';
export { ConfirmWishErDef } from './wish/er/confirm-wish.er';
export { FulfillWishErDef } from './wish/er/fulfill-wish.er';
export * from './wish/pools/course-pool';
export { CancelWishUcDef } from './wish/uc/cancel-wish.uc';
export { CreateCourseWishUcDef } from './wish/uc/create-course-wish.uc';
export { CreateModuleWishUcDef } from './wish/uc/create-module-wish.uc';
export { ListUserWishesUcDef } from './wish/uc/list-user-wishes.uc';
export * from './wish/wish.ar';
export * from './wish/wish.policy';
export * from './wish/wish.rules';
export type { FulfillmentTargets } from './wish/wish.types';
export { WishModuleDef } from './wish.module';
export { WishFulfillmentDcs } from './wish-fulfillment.dcs';
export type {
  FulfillmentAnswer,
  FulfillmentQuestion,
} from './wish-fulfillment.types';
// gen:exports

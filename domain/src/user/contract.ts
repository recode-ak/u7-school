/** Контракт модуля user: паспорт внешнего модуля (D-37), фасад, события, ошибки. */
export type { UserFacade } from './facade';
export type {
  AccessDeniedUcError,
  TelegramIdTakenUcError,
  UserModuleError,
  UserNotFoundUcError,
} from './user/commands/errors';
export type { User } from './user/entity';
export type { UserNotifiedEvent } from './user/events';
export { Role } from './user/roles';
export {
  GetTelegramAddressesUcDef,
  type TelegramAddresses,
} from './user/uc/get-telegram-addresses.uc';
export type { UserView } from './user/user.ar';
/**
 * Агрегат пользователя: субъект `Caller`, вопросы ролей для Policy клиентов;
 * чужой код видит `ReadonlyAr<UserAr>` (D-69).
 */
export { UserAr } from './user/user.ar';
export { UserErrors } from './user/user.errors';
export { UserModuleDef } from './user.module';

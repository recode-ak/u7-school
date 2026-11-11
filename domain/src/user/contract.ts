/**
 * Контракт модуля user: агрегат `UserAr` (субъект `Caller`, D-69), `UserView`,
 * Def UC, ошибки.
 */
export { AddRoleToUserUcDef } from './user/uc/add-role-to-user.uc';
export {
  GetTelegramAddressesUcDef,
  type TelegramAddresses,
} from './user/uc/get-telegram-addresses.uc';
export { GetUserUcDef } from './user/uc/get-user.uc';
export { GetUserByTelegramIdUcDef } from './user/uc/get-user-by-telegram-id.uc';
export { GetUsersByIdsUcDef } from './user/uc/get-users-by-ids.uc';
export { ListUsersUcDef, UserSort } from './user/uc/list-users.uc';
export { RegisterGuestUcDef } from './user/uc/register-guest.uc';
export { RemoveRoleFromUserUcDef } from './user/uc/remove-role-from-user.uc';
export type { UserView } from './user/user.ar';
/**
 * Агрегат пользователя: субъект `Caller`, вопросы ролей для Policy клиентов;
 * чужой код видит `ReadonlyAr<UserAr>` (D-69).
 */
export { UserAr } from './user/user.ar';
export { UserErrors } from './user/user.errors';
export { UserModuleDef } from './user.module';

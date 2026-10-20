/** Контракт модуля user: фасад, события, ошибки. */
export type { UserFacade } from './facade';
export type {
  AccessDeniedUcError,
  TelegramIdTakenUcError,
  UserModuleError,
  UserNotFoundUcError,
} from './user/commands/errors';
export type { UserNotifiedEvent } from './user/events';

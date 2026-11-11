import { getGlobalLogger } from '@u7-scl/core/shared';
import {
  GetUserByTelegramIdUcDef,
  RegisterGuestUcDef,
  UserErrors,
  UserModuleDef,
} from '@u7-scl/domain/user/contract';
import { dispatchModuleUc } from './core/dispatch-uc';
import type { U7BotUiAppResolve } from './core/u7-bot-app-meta';

/** Данные отправителя из Telegram, достаточные для регистрации гостя. */
export interface TgSender {
  id: number;
  first_name: string;
  username?: string;
}

/**
 * Регистрирует гостя, если его ещё нет (сценарии /start и вход в группу):
 * `registerGuest` требует роль ADMIN, поэтому действует бот (`botAdminUuid`) —
 * ослаблять политику UC нельзя, после выноса API в web это открыло бы анонимную регистрацию.
 *
 * @see ensure-registered.test.ts
 */
export async function ensureRegisteredGuest(
  resolve: Pick<U7BotUiAppResolve, 'appApi' | 'callers' | 'botAdminUuid'>,
  sender: TgSender,
): Promise<void> {
  const warn = (message: string, meta: { uc: string }) =>
    getGlobalLogger()?.warn('ensure-registered', message, meta);

  const lookup = await dispatchModuleUc(
    UserModuleDef,
    GetUserByTelegramIdUcDef.command({ telegramId: sender.id }),
    { resolve, telegramId: sender.id, warn },
  );
  if (lookup.ok) return;
  if (lookup.error.code !== UserErrors.NOT_FOUND.code) {
    throw new Error(lookup.error.code);
  }

  const registered = await dispatchModuleUc(
    UserModuleDef,
    RegisterGuestUcDef.command({
      telegramId: sender.id,
      name: sender.first_name,
      ...(sender.username !== undefined ? { nick: sender.username } : {}),
    }),
    { resolve, uuid: resolve.botAdminUuid, telegramId: sender.id, warn },
  );
  if (registered.ok) return;
  if (registered.error.code === UserErrors.TELEGRAM_ID_TAKEN.code) return;
  throw new Error(registered.error.code);
}

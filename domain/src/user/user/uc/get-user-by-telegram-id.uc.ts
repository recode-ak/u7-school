import { allowAll, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { UserArDef, UserView } from '../user.ar';
import { UserErrors } from '../user.errors';
import { UserState } from '../user.state';

/**
 * Профиль по telegramId — вход бота для незарегистрированного гостя, поэтому
 * `callers` включает гостя. Нет пользователя — `USER_NOT_FOUND` с telegramId.
 */
export const GetUserByTelegramIdUcDef = UseCaseDef.define({
  name: 'getUserByTelegramId',
  label: 'Найти пользователя по Telegram ID',
  description:
    'Профиль пользователя по telegramId; нет пользователя — USER_NOT_FOUND.',
  type: 'query',
  aggregate: UserArDef,
  callers: ['guest', 'user', 'system'],
  policy: allowAll,
  input: v.object({ telegramId: UserState.entries.telegramId }),
  output: UserView,
  errors: [UserErrors.NOT_FOUND],
});

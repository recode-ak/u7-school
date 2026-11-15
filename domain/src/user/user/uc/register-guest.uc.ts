import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { UserArDef, UserView } from '../user.ar';
import { UserErrors } from '../user.errors';
import { UserPolicy } from '../user.policy';
import { UserRules } from '../user.rules';
import { UserState } from '../user.state';

/**
 * Регистрация гостя: право — администратор, telegramId должен быть свободен
 * (правило `telegramIdFree`, держателя ищет `load`). Пустой ник не пишется —
 * схема входа его пропускает, отбрасывает агрегат.
 */
export const RegisterGuestUcDef = UseCaseDef.define({
  name: 'registerGuest',
  label: 'Зарегистрировать гостя',
  description:
    'Создаёт пользователя с ролью GUEST на свободный telegramId: имя и необязательный ник.',
  type: 'command',
  aggregate: UserArDef,
  callers: ['user'],
  policy: UserPolicy.rules.canRegisterGuest,
  rules: [UserRules.rules.telegramIdFree],
  input: v.object({
    telegramId: UserState.entries.telegramId,
    name: UserState.entries.name,
    nick: v.optional(
      F.sensitive(v.pipe(v.string(), v.description('Ник в Telegram'))),
    ),
  }),
  output: UserView,
  errors: [UserErrors.TELEGRAM_ID_TAKEN],
});

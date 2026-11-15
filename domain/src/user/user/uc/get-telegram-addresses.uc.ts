import { allowAll, F, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { UserArDef } from '../user.ar';

/**
 * Адреса Telegram пользователей — для других модулей: батч по
 * пользователям за один вызов. В ответ попадают только пользователи с
 * telegramId; неизвестный пользователь или недоступный профиль — просто
 * нет в ответе, без ошибки.
 *
 * `allowAll`: вызывает только система (адресация уведомлений), субъекта
 * нет.
 */
export const GetTelegramAddressesUcDef = UseCaseDef.define({
  name: 'getTelegramAddresses',
  label: 'Адреса Telegram пользователей',
  description:
    'У каких из переданных пользователей известен telegramId, и каков он, — для других модулей.',
  type: 'query',
  aggregate: UserArDef,
  callers: ['system'],
  policy: allowAll,
  input: v.object({
    userIds: v.pipe(
      v.array(F.uuid('пользователя')),
      v.description('Пользователи, чьи адреса нужны'),
    ),
  }),
  output: v.object({
    addresses: v.pipe(
      v.array(
        v.object({
          userId: F.uuid('пользователя'),
          telegramId: F.sensitive(F.int('telegramId пользователя')),
        }),
      ),
      v.description('Адреса пользователей, у которых есть telegramId'),
    ),
  }),
  errors: [],
});

/** Ответ: адреса Telegram достижимых пользователей. */
export type TelegramAddresses = OutputOf<typeof GetTelegramAddressesUcDef>;

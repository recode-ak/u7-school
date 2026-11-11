import { ErrorDef, F } from 'dmg-core';
import * as v from 'valibot';

/**
 * Ошибки агрегата `user`. `label` — текст для пользователя; код
 * `USER_NOT_FOUND` совпадает с legacy, `USER_TELEGRAM_ID_TAKEN` добавлен
 * префикс по ERR-04 (вызывающих у прежнего кода нет).
 */
export const UserErrors = ErrorDef.define('USER', {
  NOT_FOUND: {
    kind: 'not_found',
    label: 'Пользователь не найден',
    description: 'Пользователя с таким идентификатором или telegramId нет.',
    // Ровно один идентификатор: пользователя ищут либо по uuid, либо по telegramId.
    payload: v.union([
      v.strictObject({ uuid: F.uuid('пользователя') }),
      v.strictObject({ telegramId: F.int('telegramId пользователя') }),
    ]),
  },
  TELEGRAM_ID_TAKEN: {
    kind: 'conflict',
    label: 'Этот Telegram ID уже занят',
    description: 'Telegram ID принадлежит другому пользователю.',
    payload: v.object({ telegramId: F.int('telegramId пользователя') }),
  },
});

import { EventDef, F } from 'dmg-core';
import * as v from 'valibot';

const userId = F.uuid('пользователя-желающего');

/** Адресат приглашения: пользователь, его Telegram и поток с набором. */
const addressee = {
  userId,
  telegramId: F.sensitive(
    F.int(
      'telegramId адресата: резолвит ER из профиля пользователя, по нему UI отправляет карточку',
    ),
  ),
  streamId: F.uuid('потока с открытым набором'),
};

/**
 * События агрегата `wish`.
 *
 * - `confirmed` порождает переход `WishAr.confirm`.
 * - `invited` строит ER invite-wishers (`WishEvents.invited.make`): решение
 *   «пригласить» — сопоставление потока с целью через фасад курсов и
 *   адресация через фасад пользователей, состояние желания не меняется.
 */
export const WishEvents = EventDef.define('wish.wish', {
  invited: {
    label: 'Желающий приглашён на поток',
    description:
      'Открыт набор на поток, подходящий цели желания; карточку с кнопкой отмены рендерит UI-сторя wish-invite.',
    payload: v.variant('targetKind', [
      v.object({
        ...addressee,
        targetKind: v.pipe(
          v.literal('course'),
          v.description('Вид желания — курс'),
        ),
        courseId: F.uuid('курса из цели желания'),
      }),
      v.object({
        ...addressee,
        targetKind: v.pipe(
          v.literal('module'),
          v.description('Вид желания — модуль'),
        ),
        moduleId: F.uuid('модуля из цели желания'),
      }),
    ]),
  },
  confirmed: {
    label: 'Желание подтверждено',
    description:
      'Анкета желания на курс завершена, желание подтверждено; уведомление менторам рендерит UI-сторя wish-confirmed.',
    payload: v.object({
      userId,
      courseId: F.uuid('курса, на который подтверждено желание'),
    }),
  },
});

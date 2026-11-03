import { ErrorDef, F } from 'dmg-core';
import * as v from 'valibot';
import { WishStatus } from './wish.state';

const userId = F.uuid('пользователя-желающего');
const courseId = F.uuid('курса из цели желания');
const moduleId = F.uuid('модуля из цели желания');

/**
 * Payload с целью желания: ровно один из идентификаторов — курс или модуль.
 * `strictObject` — лишний ключ (оба id) отклоняется; форма на проводе та же.
 */
const withTarget = <T extends v.ObjectEntries>(entries: T) =>
  v.union([
    v.strictObject({
      userId,
      courseId: v.pipe(courseId, v.description('Цель — курс')),
      ...entries,
    }),
    v.strictObject({
      userId,
      moduleId: v.pipe(moduleId, v.description('Цель — модуль')),
      ...entries,
    }),
  ]);

/**
 * Ошибки агрегата `wish`: отказы переходов (`conflict`) и ошибки UC.
 * `label` — прежний текст legacy-исключения: UC/ER поднимают его, пока
 * `Result` не дошёл до вызывающих.
 *
 * `COURSE_NOT_FOUND`/`MODULE_NOT_FOUND` модуля `course` здесь не
 * пробрасываются: фасад курсов legacy и ошибок не объявляет, а смысл другой —
 * цель есть, но для записи недоступна (для студента неотличима от
 * отсутствующей). Коды уникальны в приложении — префикс `WISH_`.
 */
export const WishErrors = ErrorDef.define('WISH', {
  NOT_CONFIRMABLE: {
    kind: 'conflict',
    label: 'Подтвердить можно только ожидающее анкету желание',
    description: 'Подтверждение доступно только из pending (анкетная ветка).',
  },
  NOT_ABANDONABLE: {
    kind: 'conflict',
    label: 'Бросить можно только ожидающее анкету желание',
    description: 'Прервать анкету можно только у желания в pending.',
  },
  NOT_CANCELLABLE: {
    kind: 'conflict',
    label: 'Отменить можно только выраженное или подтверждённое желание',
    description:
      'Отмена доступна из expressed и confirmed; для pending — только abandon.',
  },
  NOT_FULFILLABLE: {
    kind: 'conflict',
    label: 'Реализовать можно только выраженное или подтверждённое желание',
    description:
      'Реализация доступна из expressed и confirmed; pending сначала подтверждается анкетой.',
  },
  NOT_INVITABLE: {
    kind: 'conflict',
    label: 'Пригласить можно только выраженное или подтверждённое желание',
    description:
      'Приглашение на поток доступно из expressed и confirmed; остальные желания уже не ждут набора.',
  },
  ALREADY_EXISTS: {
    kind: 'conflict',
    label: 'Желание уже выражено',
    description:
      'У пользователя уже есть активное (expressed | pending | confirmed) желание на эту цель.',
    payload: withTarget({
      status: v.pipe(
        WishStatus,
        v.description(
          'Статус существующего активного желания — по нему ветвится UI',
        ),
      ),
    }),
  },
  NOT_FOUND: {
    kind: 'not_found',
    label: 'Желание не найдено',
    description:
      'Нет желания пользователя на цель в статусе, допускающем операцию.',
    payload: withTarget({}),
  },
  COURSE_NOT_FOUND: {
    kind: 'not_found',
    label: 'Курс не найден',
    description:
      'Курс недоступен для записи (не опубликован, в архиве или без стартового модуля) — для студента неотличим от отсутствующего.',
    payload: v.object({ courseId }),
  },
  MODULE_NOT_FOUND: {
    kind: 'not_found',
    label: 'Модуль не найден',
    description:
      'Модуля нет в программе ни одного опубликованного курса — записаться на него нельзя.',
    payload: v.object({ moduleId }),
  },
});

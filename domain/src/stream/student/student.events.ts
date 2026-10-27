import { EventDef, F } from 'dmg-core';
import * as v from 'valibot';

/**
 * События студента потока — контракт внешнего модуля `stream` (D-37).
 * Публикует legacy-агрегат `StudentAr`; в DMG их доставляет карта `inbound`.
 * При миграции модуля контракт остаётся.
 */
export const StudentEvents = EventDef.define('stream.student', {
  enrolled: {
    label: 'Студент зачислен',
    description:
      'Пользователь зачислен на поток. Курс модуля потребитель резолвит через модуль курсов.',
    payload: v.object({
      studentId: F.uuid('записи студента'),
      userId: F.uuid('пользователя'),
      streamId: F.uuid('потока'),
      moduleId: F.uuid('модуля потока'),
    }),
  },
});

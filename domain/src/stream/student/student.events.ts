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
  completed: {
    label: 'Студент завершил модуль потока',
    description:
      'Студент завершил модуль потока: прошёл (advanced) или не прошёл (not_advanced). Потребители — окна отзывов о судьбе студента.',
    payload: v.object({
      studentId: F.uuid('записи студента'),
      userId: F.uuid('пользователя'),
      streamId: F.uuid('потока'),
      moduleId: F.uuid('завершённого модуля'),
      outcome: F.picklist(['advanced', 'not_advanced'], 'исхода завершения'),
    }),
  },
  abandoned: {
    label: 'Студент снят с учёбы',
    description:
      'Студент ушёл с потока: сам (self) или по решению ментора (mentor); cause — причина ухода.',
    payload: v.object({
      studentId: F.uuid('записи студента'),
      userId: F.uuid('пользователя'),
      streamId: F.uuid('потока'),
      who: F.picklist(['self', 'mentor'], 'инициатора ухода'),
      cause: F.picklist(
        ['voluntary', 'inactivity', 'by_mentor'],
        'причины ухода',
      ),
    }),
  },
});

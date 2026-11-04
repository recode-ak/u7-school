import { EventDef, F } from 'dmg-core';
import * as v from 'valibot';

/**
 * События студента потока. Публикует UoW агрегата `StudentAr`; уведомления
 * о бездействии — Job `inactivitySweep` (адресатов и тексты определяет бот).
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
  inactivityWarning: {
    label: 'Студент не занимается',
    description:
      'Студент не занимался несколько дней: предупреждение студенту (с 5-го дня, затем каждые 2 дня).',
    payload: v.object({
      studentId: F.uuid('записи студента'),
      userId: F.uuid('студента'),
      streamId: F.uuid('потока'),
      days: F.int('полных дней без активности'),
    }),
  },
  inactivityRemoveCandidate: {
    label: 'Студент — кандидат на снятие с учёбы',
    description:
      'Студент не занимался неделю и больше: уведомление ментору с предложением снять (с 7-го дня, затем каждые 2 дня).',
    payload: v.object({
      studentId: F.uuid('записи студента'),
      userId: F.uuid('студента'),
      streamId: F.uuid('потока'),
      days: F.int('полных дней без активности'),
      wasWarned: F.boolean('студенту ранее отправлялись предупреждения'),
    }),
  },
});

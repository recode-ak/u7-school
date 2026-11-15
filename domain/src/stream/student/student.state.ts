import { BaseEntityFields, F } from 'dmg-core';
import * as v from 'valibot';

/** Детали ухода студента: кто инициировал и по какой причине. */
export const AbandonDetailsVo = v.pipe(
  v.object({
    who: F.picklist(['self', 'mentor'], 'инициатора ухода'),
    cause: F.picklist(
      ['voluntary', 'inactivity', 'by_mentor'],
      'причины ухода',
    ),
  }),
  v.description('Детали ухода студента'),
);

/** Детали завершения: пожелание студента о следующем шаге обучения. */
export const CompletionDetailsVo = v.pipe(
  v.object({
    nextPreference: F.picklist(
      ['wants_next', 'wants_repeat', 'undecided'],
      'пожелания о следующем шаге обучения',
    ),
  }),
  v.description('Детали завершения модуля потока'),
);

/**
 * Запись о прохождении шага: выдан или завершён. `completionSource` —
 * шаг зачтён синхронизацией контента (F-80), а не пройден студентом.
 */
export const StepRecordVo = v.pipe(
  v.object({
    stepId: F.uuid('шага'),
    status: F.picklist(['issued', 'completed'], 'статуса прохождения шага'),
    issuedAt: F.timestamp('выдачи шага'),
    completedAt: v.optional(F.timestamp('завершения шага')),
    completionSource: v.optional(
      F.picklist(['content_sync'], 'источника завершения шага'),
    ),
  }),
  v.description('Запись о прохождении шага студентом'),
);

/**
 * Вид уведомления о бездействии: у студента и у ментора независимые цепочки
 * повтора «через 2 дня».
 */
export const StudentNoticeKind = F.picklist(
  ['inactivity_warn_student', 'inactivity_warn_mentor'],
  'вида уведомления о бездействии',
);

/** Маркер отправленного уведомления: вид и время (до минуты). */
export const StudentNoticeVo = v.pipe(
  v.object({
    kind: StudentNoticeKind,
    sentAt: F.timestamp('последней отправки уведомления'),
  }),
  v.description('Маркер отправленного уведомления о бездействии'),
);

/**
 * Entity студента (записи на потоке) — единственное место структуры
 * состояния. Записи без полей читаются: нет `updatedAt` → `createdAt`, нет `version` → 0 (D-36).
 */
export const StudentState = v.object({
  ...BaseEntityFields,
  streamId: F.uuid('потока'),
  userId: F.uuid('пользователя'),
  enrolledAt: F.timestamp('зачисления'),
  status: F.picklist(
    ['enrolled', 'active', 'abandoned', 'advanced', 'not_advanced'],
    'Статус студента: зачислен, учится, ушёл, прошёл, не прошёл',
  ),
  abandonDetails: v.optional(AbandonDetailsVo),
  completionDetails: v.optional(CompletionDetailsVo),
  currentStepId: F.uuid('текущего шага'),
  steps: v.pipe(v.array(StepRecordVo), v.description('Шаги студента')),
  notices: v.optional(
    v.pipe(
      v.array(StudentNoticeVo),
      v.description('Маркеры уведомлений о бездействии'),
    ),
  ),
});

export type StudentState = v.InferOutput<typeof StudentState>;
export type StepRecord = StudentState['steps'][number];
export type StudentNoticeKind = v.InferOutput<typeof StudentNoticeKind>;

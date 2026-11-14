import type { UserAr } from '@u7-scl/domain/user/contract';
import { PolicyDef, type ReadonlyAr, Rule } from 'dmg-core';
import type { StudentAr } from '../student/student.ar';
import type { StreamAr } from './stream.ar';

/** Субъект прав потока: вопросы ролей — у `UserAr` (D-69). */
type StreamSubject = Pick<ReadonlyAr<UserAr>, 'uuid' | 'isMentor' | 'isAdmin'>;

/** Контекст прав на поток: поток, над которым действие. */
export type StreamCtx = { readonly stream: ReadonlyAr<StreamAr> };

/** Контекст чтения материалов потока: поток и запись вызывающего в нём, если есть. */
export type StreamContentCtx = StreamCtx & {
  readonly student: ReadonlyAr<StudentAr> | undefined;
};

/** Контекст чтения шага по снимку: контекст материалов и шаг. */
export type StreamStepCtx = StreamContentCtx & { readonly stepId: string };

const canCreate = Rule.of({
  name: 'canCreate',
  label: 'Ментор',
  denyMessage: 'Недостаточно прав для создания потока',
  check: (subject: StreamSubject) => subject.isMentor(),
});

const isStreamMentor = Rule.of({
  name: 'isStreamMentor',
  label: 'Ментор потока',
  denyMessage: 'Недостаточно прав для управления потоком',
  check: (subject: StreamSubject, ctx: StreamCtx) =>
    ctx.stream.isMentoredBy(subject.uuid),
});

const isAdmin = Rule.of({
  name: 'isAdmin',
  label: 'Администратор',
  denyMessage: 'Недостаточно прав для управления потоком',
  check: (subject: StreamSubject) => subject.isAdmin(),
});

const CONTENT_DENIED = 'Нет доступа к материалам потока';

const isStreamStudent = Rule.of({
  name: 'isStreamStudent',
  label: 'Студент потока',
  denyMessage: CONTENT_DENIED,
  check: (subject: StreamSubject, { stream, student }: StreamContentCtx) =>
    student?.isOwnedBy(subject.uuid) === true &&
    student.belongsToStream(stream.uuid),
});

const hasIssuedStep = Rule.of({
  name: 'hasIssuedStep',
  label: 'Студент потока, шаг в его прогрессе',
  denyMessage: 'Шаг ещё не пройден и не выдан',
  check: (subject: StreamSubject, ctx: StreamStepCtx) =>
    isStreamStudent.check(subject, ctx) &&
    ctx.student?.hasIssued(ctx.stepId) === true,
});

/**
 * Права на потоки. Создаёт поток роль `MENTOR` (администратор без неё —
 * нет, как в legacy); управляет ментор потока или администратор. Чтение
 * потока открыто всем — `allowAll` в Def UC; материалы по снимку
 * (`canReadContent`) — студенту потока (с любым исходом), его ментору и
 * администратору.
 */
export const StreamPolicy = PolicyDef.define({
  name: 'stream',
  label: 'Права на потоки',
  description:
    'Кто создаёт поток — ментор; кто управляет потоком — его ментор или администратор; кто читает материалы потока — его студент, ментор или администратор.',
  rules: {
    canCreate,
    canManage: Rule.anyOf(
      {
        name: 'canManage',
        label: 'Ментор потока или администратор',
        denyMessage: 'Недостаточно прав для управления потоком',
      },
      isStreamMentor,
      isAdmin,
    ),
    canReadContent: Rule.anyOf(
      {
        name: 'canReadContent',
        label: 'Студент потока, ментор потока или администратор',
        denyMessage: CONTENT_DENIED,
      },
      isStreamStudent,
      isStreamMentor,
      isAdmin,
    ),
    canReadStep: Rule.anyOf(
      {
        name: 'canReadStep',
        label:
          'Студент потока с выданным шагом, ментор потока или администратор',
        denyMessage: CONTENT_DENIED,
      },
      hasIssuedStep,
      isStreamMentor,
      isAdmin,
    ),
  },
});

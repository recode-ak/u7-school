import type { UserAr } from '@u7-scl/domain/user/contract';
import { PolicyDef, type ReadonlyAr, Rule } from 'dmg-core';
import type { StreamAr } from '../stream/stream.ar';
import type { StudentAr } from './student.ar';

/** Субъект прав студента: вопросы ролей — у `UserAr` (D-69). */
type StudentSubject = Pick<ReadonlyAr<UserAr>, 'uuid' | 'isAdmin'>;

/** Контекст прав на запись студента. */
export type StudentCtx = { readonly student: ReadonlyAr<StudentAr> };

/** Контекст прав ментора потока над студентом: запись и её поток. */
export type StudentStreamCtx = StudentCtx & {
  readonly stream: ReadonlyAr<StreamAr>;
};

const isSelf = Rule.of({
  name: 'isSelf',
  label: 'Сам студент',
  denyMessage: 'Вы не можете выйти из чужого потока',
  check: (subject: StudentSubject, ctx: StudentCtx) =>
    ctx.student.isOwnedBy(subject.uuid),
});

const isStreamMentor = (denyMessage: string) =>
  Rule.of({
    name: 'isStreamMentor',
    label: 'Ментор потока',
    denyMessage,
    check: (subject: StudentSubject, ctx: StudentStreamCtx) =>
      ctx.stream.isMentoredBy(subject.uuid),
  });

const isAdmin = (denyMessage: string) =>
  Rule.of({
    name: 'isAdmin',
    label: 'Администратор',
    denyMessage,
    check: (subject: StudentSubject) => subject.isAdmin(),
  });

const mentorOrAdmin = (name: string, denyMessage: string) =>
  Rule.anyOf(
    { name, label: 'Ментор потока или администратор', denyMessage },
    isStreamMentor(denyMessage),
    isAdmin(denyMessage),
  );

/**
 * Права на студента. Завершать шаг и выходить из потока может сам студент
 * (`isSelf` — для шага и выхода; в legacy шаг не проверялся). Указывать исход
 * и снимать с учёбы — ментор потока студента или администратор. Чтение
 * открыто — `allowAll`.
 */
export const StudentPolicy = PolicyDef.define({
  name: 'student',
  label: 'Права на студентов',
  description:
    'Кто завершает шаги и выходит из потока — сам студент; кто указывает исход и снимает с учёбы — ментор потока или администратор.',
  rules: {
    isSelf,
    canComplete: mentorOrAdmin(
      'canComplete',
      'Недостаточно прав для завершения студента',
    ),
    canMarkAbandoned: mentorOrAdmin(
      'canMarkAbandoned',
      'Недостаточно прав для снятия студента с учёбы',
    ),
  },
});

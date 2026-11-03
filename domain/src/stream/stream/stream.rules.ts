import { DomainRuleDef, err, ok, RulesDef } from 'dmg-core';
import { StreamErrors } from './stream.errors';
import type { StreamStudentFact } from './stream.types';

/** Контекст правила завершения: студенты потока. */
export type StudentsSettledCtx = {
  readonly students: readonly StreamStudentFact[];
};

/**
 * Поток завершается, только когда у каждого студента есть исход —
 * допуск без субъекта (D-40). «Есть ли исход» отвечает студент (`settled`
 * в факте); отказ перечисляет тех, кто ещё не определился.
 */
const studentsSettled = DomainRuleDef.define({
  name: 'studentsSettled',
  label: 'У всех студентов есть исход',
  description:
    'Поток завершается, только если ни один студент не учится и не ждёт старта: ментор указал исход каждому.',
  error: StreamErrors.STUDENTS_IN_PROGRESS,
  check: ({ students }: StudentsSettledCtx) => {
    const pending = students
      .filter((student) => !student.settled)
      .map(({ userId, status }) => ({ userId, status }));
    return pending.length === 0
      ? ok()
      : err(StreamErrors.STUDENTS_IN_PROGRESS.make({ pending }));
  },
});

export const StreamRules = RulesDef.define({
  name: 'stream',
  label: 'Правила потоков',
  description: 'Допустимость действий с потоком при состоянии его студентов.',
  rules: { studentsSettled },
});

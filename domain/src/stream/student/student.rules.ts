import type { ModulePrerequisite } from '@u7-scl/domain/course/contract';
import { DomainRuleDef, ok, type ReadonlyAr, RulesDef } from 'dmg-core';
import type { StreamAr } from '../stream/stream.ar';
import type { StudentAr } from './student.ar';
import { StudentErrors } from './student.errors';

/**
 * Контекст правил зачисления: поток, введённое кодовое слово, все записи
 * пользователя и условие допуска к модулю от курсов.
 */
export type EnrollStudentCtx = {
  readonly stream: ReadonlyAr<StreamAr>;
  readonly enrollmentKey?: string;
  readonly userStudents: readonly ReadonlyAr<StudentAr>[];
  readonly prerequisite: ModulePrerequisite;
};

/** Кодовое слово потока принято (потоку слово не задано — принято любое). */
const enrollmentKeyAccepted = DomainRuleDef.define({
  name: 'enrollmentKeyAccepted',
  label: 'Кодовое слово принято',
  description:
    'Если для потока задано кодовое слово, зачислить можно только с тем же словом.',
  error: StudentErrors.WRONG_ENROLLMENT_KEY,
  check: ({ stream, enrollmentKey }: EnrollStudentCtx) =>
    stream.acceptsEnrollmentKey(enrollmentKey)
      ? ok()
      : StudentErrors.WRONG_ENROLLMENT_KEY.err(),
});

/** У пользователя нет живой записи — в этом или любом другом потоке. */
const notStudyingElsewhere = DomainRuleDef.define({
  name: 'notStudyingElsewhere',
  label: 'Нет живой записи студента',
  description:
    'Зачислить можно, только если пользователь сейчас не учится и не зачислен ни в одном потоке.',
  error: StudentErrors.ALREADY_STUDYING,
  check: ({ userStudents }: EnrollStudentCtx) =>
    userStudents.some((student) => student.isInProgress())
      ? StudentErrors.ALREADY_STUDYING.err()
      : ok(),
});

/**
 * Допуск к модулю по вердикту курса (D-65): правило ничего не сравнивает, а
 * переводит вердикт в отказ. Название предыдущего модуля — для текста отказа;
 * `closed` — предыдущий модуль определить нельзя.
 */
const prerequisitePassed = DomainRuleDef.define({
  name: 'prerequisitePassed',
  label: 'Предыдущий модуль пройден',
  description:
    'Зачислить на модуль можно, только если пройден предыдущий модуль курса (если он есть).',
  error: StudentErrors.PREREQUISITE_NOT_PASSED,
  check: ({ prerequisite }: EnrollStudentCtx) => {
    if (prerequisite.admitted) return ok();
    return StudentErrors.PREREQUISITE_NOT_PASSED.err({
      moduleTitle:
        prerequisite.reason === 'closed' ? 'предыдущий' : prerequisite.title,
    });
  },
});

/** В потоке есть хотя бы один шаг. */
const streamHasSteps = DomainRuleDef.define({
  name: 'streamHasSteps',
  label: 'В потоке есть шаги',
  description:
    'Зачислить можно только в поток, в снимке контента которого есть шаг.',
  error: StudentErrors.NO_STEPS,
  check: ({ stream }: EnrollStudentCtx) =>
    stream.firstStepId() === undefined ? StudentErrors.NO_STEPS.err() : ok(),
});

/**
 * Правила зачисления в порядке legacy: ключ → живая запись → допуск → шаги.
 */
export const StudentRules = RulesDef.define({
  name: 'student',
  label: 'Правила студентов',
  description: 'Допустимость зачисления студента на поток.',
  rules: {
    enrollmentKeyAccepted,
    notStudyingElsewhere,
    prerequisitePassed,
    streamHasSteps,
  },
});

import { describe, expect, it } from 'bun:test';
import type { ModulePrerequisite } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import { StreamAr } from '../stream/stream.ar';
import { stored as streamStored } from '../stream/stream.fixture';
import { StudentAr } from './student.ar';
import { stored } from './student.fixture';
import { StudentRules } from './student.rules';

// Перенос `LegacyStreamAr.enroll` (a-root.test.ts, ветки отказов) и
// `canEnrollNextModule` (policy.test.ts) на правила зачисления (D-40).
// Порядок: ключ → активная запись → допуск → нет шагов (legacy a-root.ts:42-77).
// Допуск к модулю — вердикт курса (D-65): правило ничего не сравнивает, а
// переводит вердикт в отказ; «пройден» собирает `PassedModulesDqs` (TST-08).

const OTHER_STREAM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const stream = (extra = {}) =>
  StreamAr.restore(streamStored('enrollment', extra));
const student = (status: Parameters<typeof stored>[0], extra = {}) =>
  StudentAr.restore(stored(status, extra));

const baseCtx = {
  stream: stream(),
  enrollmentKey: undefined as string | undefined,
  userStudents: [] as StudentAr[],
  prerequisite: { admitted: true } as ModulePrerequisite,
};

const {
  enrollmentKeyAccepted,
  notStudyingElsewhere,
  prerequisitePassed,
  streamHasSteps,
} = StudentRules.rules;

describe('StudentRules — состав и порядок', () => {
  it('четыре правила в порядке legacy', () => {
    expect(Object.keys(StudentRules.rules)).toEqual([
      'enrollmentKeyAccepted',
      'notStudyingElsewhere',
      'prerequisitePassed',
      'streamHasSteps',
    ]);
  });

  it('правила ссылаются на ошибки STUDENT_*', () => {
    expect(enrollmentKeyAccepted.error.code).toBe(
      'STUDENT_WRONG_ENROLLMENT_KEY',
    );
    expect(notStudyingElsewhere.error.code).toBe('STUDENT_ALREADY_STUDYING');
    expect(prerequisitePassed.error.code).toBe(
      'STUDENT_PREREQUISITE_NOT_PASSED',
    );
    expect(streamHasSteps.error.code).toBe('STUDENT_NO_STEPS');
  });
});

describe('enrollmentKeyAccepted', () => {
  it('у потока нет ключа — ok, что бы ни ввели', () => {
    expectOk(enrollmentKeyAccepted.check(baseCtx));
    expectOk(
      enrollmentKeyAccepted.check({ ...baseCtx, enrollmentKey: 'любое' }),
    );
  });

  it('ключ совпал — ok', () => {
    expectOk(
      enrollmentKeyAccepted.check({
        ...baseCtx,
        stream: stream({ enrollmentKey: 'секрет' }),
        enrollmentKey: 'секрет',
      }),
    );
  });

  it.each([undefined, '', 'Секрет', 'секрет '])(
    'ключ задан, введено %p — STUDENT_WRONG_ENROLLMENT_KEY',
    (entered) => {
      const error = expectErr(
        enrollmentKeyAccepted.check({
          ...baseCtx,
          stream: stream({ enrollmentKey: 'секрет' }),
          enrollmentKey: entered,
        }),
        'STUDENT_WRONG_ENROLLMENT_KEY',
      );
      expect(error.kind).toBe('validation');
    },
  );
});

describe('notStudyingElsewhere', () => {
  it('записей нет — ok', () => {
    expectOk(notStudyingElsewhere.check(baseCtx));
  });

  it.each(['abandoned', 'advanced', 'not_advanced'] as const)(
    'только запись в статусе %s — ok',
    (status) => {
      expectOk(
        notStudyingElsewhere.check({
          ...baseCtx,
          userStudents: [student(status)],
        }),
      );
    },
  );

  it.each(['enrolled', 'active'] as const)(
    'живая запись %s — STUDENT_ALREADY_STUDYING',
    (status) => {
      const error = expectErr(
        notStudyingElsewhere.check({
          ...baseCtx,
          userStudents: [student('abandoned'), student(status)],
        }),
        'STUDENT_ALREADY_STUDYING',
      );
      expect(error.kind).toBe('conflict');
    },
  );

  it('поток значения не имеет: живая запись в этом же потоке тоже отказ', () => {
    expectErr(
      notStudyingElsewhere.check({
        ...baseCtx,
        userStudents: [student('active', { streamId: baseCtx.stream.uuid })],
      }),
      'STUDENT_ALREADY_STUDYING',
    );
  });
});

describe('prerequisitePassed', () => {
  it('вердикт admitted (курса нет, модуль входной или предыдущий пройден) — ok', () => {
    expectOk(prerequisitePassed.check(baseCtx));
  });

  it('closed — отказ с «предыдущий»', () => {
    const error = expectErr(
      prerequisitePassed.check({
        ...baseCtx,
        prerequisite: { admitted: false, reason: 'closed' },
      }),
      'STUDENT_PREREQUISITE_NOT_PASSED',
    );
    expect(error.payload).toEqual({ moduleTitle: 'предыдущий' });
  });

  it('previous-not-passed — отказ с названием модуля из вердикта', () => {
    const error = expectErr(
      prerequisitePassed.check({
        ...baseCtx,
        prerequisite: {
          admitted: false,
          reason: 'previous-not-passed',
          title: 'Основы',
        },
      }),
      'STUDENT_PREREQUISITE_NOT_PASSED',
    );
    expect(error.payload).toEqual({ moduleTitle: 'Основы' });
    expect(error.label).toBe('Сначала пройдите предыдущий модуль');
  });

  it('записи студента вердикт не меняют: advanced при отказе — отказ, при admitted — ok', () => {
    const advanced = [student('advanced', { streamId: OTHER_STREAM })];
    expectErr(
      prerequisitePassed.check({
        ...baseCtx,
        userStudents: advanced,
        prerequisite: {
          admitted: false,
          reason: 'previous-not-passed',
          title: 'Основы',
        },
      }),
      'STUDENT_PREREQUISITE_NOT_PASSED',
    );
    expectOk(prerequisitePassed.check({ ...baseCtx, userStudents: [] }));
  });
});

describe('streamHasSteps', () => {
  it('в снимке есть шаг — ok', () => {
    expectOk(streamHasSteps.check(baseCtx));
  });

  it.each([
    ['снимок пуст', []],
    [
      'уроки без шагов',
      [
        {
          projectId: '11111111-1111-4111-8111-111111111111',
          projectTitle: 'П',
          lessons: [
            {
              lessonId: '22222222-2222-4222-8222-222222222222',
              lessonTitle: 'У',
              stepIds: [],
            },
          ],
        },
      ],
    ],
  ])('%s — STUDENT_NO_STEPS', (_, contentSnapshot) => {
    const error = expectErr(
      streamHasSteps.check({ ...baseCtx, stream: stream({ contentSnapshot }) }),
      'STUDENT_NO_STEPS',
    );
    expect(error.kind).toBe('conflict');
  });
});

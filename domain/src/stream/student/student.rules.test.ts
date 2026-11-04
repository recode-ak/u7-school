import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from 'dmg-core/testing';
import { StreamAr } from '../stream/stream.ar';
import { MODULE, stored as streamStored } from '../stream/stream.fixture';
import { StudentAr } from './student.ar';
import { STUDENT, stored } from './student.fixture';
import { StudentRules } from './student.rules';

// Перенос `LegacyStreamAr.enroll` (a-root.test.ts, ветки отказов) и
// `canEnrollNextModule` (policy.test.ts) на правила зачисления (D-40).
// Порядок: ключ → активная запись → gate → нет шагов (legacy a-root.ts:42-77).

const PREV = '12345678-1234-4234-8234-123456789012';
const OTHER_STREAM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const stream = (extra = {}) =>
  StreamAr.restore(streamStored('enrollment', extra));
const student = (status: Parameters<typeof stored>[0], extra = {}) =>
  StudentAr.restore(stored(status, extra));

const baseCtx = {
  stream: stream(),
  enrollmentKey: undefined as string | undefined,
  userStudents: [] as StudentAr[],
  userStreams: [] as StreamAr[],
  prerequisite: { gate: 'none' } as
    | { gate: 'none' }
    | { gate: 'closed' }
    | { gate: 'module'; moduleId: string; title: string },
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
  const prevStream = StreamAr.restore(
    streamStored('completed', { uuid: OTHER_STREAM, moduleId: PREV }),
  );
  const module = { gate: 'module', moduleId: PREV, title: 'Основы' } as const;

  it('gate none (курса нет или модуль входной) — ok', () => {
    expectOk(prerequisitePassed.check(baseCtx));
  });

  it('gate closed — отказ с «предыдущий»', () => {
    const error = expectErr(
      prerequisitePassed.check({
        ...baseCtx,
        prerequisite: { gate: 'closed' },
      }),
      'STUDENT_PREREQUISITE_NOT_PASSED',
    );
    expect(error.payload).toEqual({ moduleTitle: 'предыдущий' });
  });

  it('предыдущий модуль пройден (advanced в потоке этого модуля) — ok', () => {
    expectOk(
      prerequisitePassed.check({
        ...baseCtx,
        prerequisite: module,
        userStudents: [
          student('advanced', { streamId: OTHER_STREAM, uuid: STUDENT }),
        ],
        userStreams: [prevStream],
      }),
    );
  });

  it('not_advanced не «прошёл» — отказ с названием модуля', () => {
    const error = expectErr(
      prerequisitePassed.check({
        ...baseCtx,
        prerequisite: module,
        userStudents: [student('not_advanced', { streamId: OTHER_STREAM })],
        userStreams: [prevStream],
      }),
      'STUDENT_PREREQUISITE_NOT_PASSED',
    );
    expect(error.payload).toEqual({ moduleTitle: 'Основы' });
  });

  it('прошёл другой модуль — отказ', () => {
    const otherModule = StreamAr.restore(
      streamStored('completed', { uuid: OTHER_STREAM, moduleId: MODULE }),
    );
    expectErr(
      prerequisitePassed.check({
        ...baseCtx,
        prerequisite: module,
        userStudents: [student('advanced', { streamId: OTHER_STREAM })],
        userStreams: [otherModule],
      }),
      'STUDENT_PREREQUISITE_NOT_PASSED',
    );
  });

  it('записей нет — отказ', () => {
    expectErr(
      prerequisitePassed.check({ ...baseCtx, prerequisite: module }),
      'STUDENT_PREREQUISITE_NOT_PASSED',
    );
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

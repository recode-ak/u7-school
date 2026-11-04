import { beforeEach, describe, expect, it } from 'bun:test';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { ok } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import { EnrollStudentUc } from './enroll-student.uc';
import {
  anonymous,
  done,
  issued,
  MODULE,
  makeEnv,
  OTHER_STREAM,
  owner,
  PREV_MODULE,
  prevStream,
  REQ,
  STEP_1,
  STREAM,
  streamOf,
  studentState,
  USER,
} from './student-uc.fixture';

// Перенос `api/student/enroll-student-uc.test.ts`. Порядок отказов: ключ →
// активная запись (в том числе в этом же потоке) → gate → нет шагов; курса нет —
// gate пропускается; статус потока не проверяется. Зачисляется субъект вызова
// (С3); роль STUDENT stream не выдаёт.

let env: ReturnType<typeof makeEnv>;
const uc = () => new EnrollStudentUc(env.deps, StreamModuleDef);
const enroll = (input: { enrollmentKey?: string } = {}, caller = owner) =>
  uc().handle({ streamId: STREAM, ...input }, caller, REQ);

beforeEach(() => {
  env = makeEnv();
  env.seedStreams(streamOf('enrollment'));
  env.seedStudents();
});

describe('EnrollStudentUc — успех', () => {
  it('создаёт студента enrolled: userId — субъект, шагов нет, currentStepId — первый шаг', async () => {
    const { studentId } = expectOk(await enroll());

    const saved = env.students.restoredOrThrow(studentId).snapshot();
    expect(saved).toMatchObject({
      streamId: STREAM,
      userId: USER,
      status: 'enrolled',
      currentStepId: STEP_1,
      steps: [],
      enrolledAt: env.ctx.app.clock(),
    });
  });

  it('событие enrolled { studentId, userId, streamId, moduleId } — единственное', async () => {
    const { studentId } = expectOk(await enroll());

    expect(env.ctx.published.map((e) => [e.name, e.payload])).toEqual([
      [
        'stream.student.enrolled',
        { studentId, userId: USER, streamId: STREAM, moduleId: MODULE },
      ],
    ]);
  });

  it('допуск спрашивают у курса по модулю потока', async () => {
    expectOk(await enroll());

    expect(env.course.received.map((c) => [c.def.name, c.input])).toEqual([
      ['getModulePrerequisite', { moduleId: MODULE }],
    ]);
  });

  it.each(['enrollment', 'active', 'completed', 'archived'] as const)(
    'статус потока %s зачислению не мешает (как в legacy)',
    async (status) => {
      env.seedStreams(streamOf(status));
      expectOk(await enroll());
    },
  );

  it('верное кодовое слово — Ok', async () => {
    env.seedStreams(streamOf('enrollment', { enrollmentKey: 'секрет' }));
    expectOk(await enroll({ enrollmentKey: 'секрет' }));
  });

  it('ушедшие и завершённые записи не мешают', async () => {
    env.seedStudents(
      studentState('abandoned', { uuid: crypto.randomUUID() }),
      studentState('not_advanced', { uuid: crypto.randomUUID() }),
    );
    expectOk(await enroll());
  });

  it('другой пользователь, чужой userId во входе игнорируется (С3)', async () => {
    const { studentId } = expectOk(
      await uc().handle(
        { streamId: STREAM, userId: crypto.randomUUID() } as never,
        owner,
        REQ,
      ),
    );
    expect(env.students.restoredOrThrow(studentId).snapshot().userId).toBe(
      USER,
    );
  });
});

describe('EnrollStudentUc — отказы', () => {
  it('вызывающий guest — UNAUTHORIZED', async () => {
    expect(
      expectErr(await enroll({}, anonymous), 'UNAUTHORIZED').payload,
    ).toEqual({ callerKind: 'guest' });
  });

  it('потока нет — STREAM_NOT_FOUND { streamId }', async () => {
    const other = '99999999-9999-4999-8999-999999999999';
    const res = await uc().handle({ streamId: other }, owner, REQ);
    const error = expectErr(res, 'STREAM_NOT_FOUND');
    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ streamId: other });
  });

  it.each([undefined, '', 'Секрет'])(
    'ключ задан, введено %p — STUDENT_WRONG_ENROLLMENT_KEY «Неверное кодовое слово»',
    async (entered) => {
      env.seedStreams(streamOf('enrollment', { enrollmentKey: 'секрет' }));
      const error = expectErr(
        await enroll({ enrollmentKey: entered }),
        'STUDENT_WRONG_ENROLLMENT_KEY',
      );
      expect(error.label).toBe('Неверное кодовое слово');
      expect(env.students.saved).toEqual([]);
      expect(env.ctx.published).toEqual([]);
    },
  );

  it.each(['enrolled', 'active'] as const)(
    'живая запись %s в другом потоке — STUDENT_ALREADY_STUDYING',
    async (status) => {
      env.seedStreams(prevStream());
      env.seedStudents(
        studentState(status, {
          uuid: crypto.randomUUID(),
          streamId: OTHER_STREAM,
        }),
      );
      expectErr(await enroll(), 'STUDENT_ALREADY_STUDYING');
    },
  );

  it('живая запись в этом же потоке — тоже STUDENT_ALREADY_STUDYING', async () => {
    env.seedStudents(studentState('active', { uuid: crypto.randomUUID() }));
    expectErr(await enroll(), 'STUDENT_ALREADY_STUDYING');
  });

  it('в потоке нет шагов — STUDENT_NO_STEPS', async () => {
    env.seedStreams(streamOf('enrollment', { contentSnapshot: [] }));
    expectErr(await enroll(), 'STUDENT_NO_STEPS');
    expect(env.students.saved).toEqual([]);
  });

  it('порядок: ключ → активная запись → gate → нет шагов', async () => {
    const LIVE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    env.seedStreams(
      streamOf('enrollment', { enrollmentKey: 'секрет', contentSnapshot: [] }),
    );
    env.seedStudents(studentState('active', { uuid: LIVE }));
    env.prerequisite = ok({ gate: 'closed' });

    expectErr(
      await enroll({ enrollmentKey: 'нет' }),
      'STUDENT_WRONG_ENROLLMENT_KEY',
    );
    expectErr(
      await enroll({ enrollmentKey: 'секрет' }),
      'STUDENT_ALREADY_STUDYING',
    );

    env.seedStudents(studentState('abandoned', { uuid: LIVE }));
    expectErr(
      await enroll({ enrollmentKey: 'секрет' }),
      'STUDENT_PREREQUISITE_NOT_PASSED',
    );

    env.prerequisite = ok({ gate: 'none' });
    expectErr(await enroll({ enrollmentKey: 'секрет' }), 'STUDENT_NO_STEPS');
  });
});

describe('EnrollStudentUc — допуск к модулю (gate)', () => {
  const module = {
    gate: 'module',
    moduleId: PREV_MODULE,
    title: 'Основы',
  } as const;

  it('gate none (курса нет или модуль входной) — Ok', async () => {
    env.prerequisite = ok({ gate: 'none' });
    expectOk(await enroll());
  });

  it('gate closed — STUDENT_PREREQUISITE_NOT_PASSED с «предыдущий»', async () => {
    env.prerequisite = ok({ gate: 'closed' });
    const error = expectErr(await enroll(), 'STUDENT_PREREQUISITE_NOT_PASSED');
    expect(error.payload).toEqual({ moduleTitle: 'предыдущий' });
  });

  it('предыдущий модуль пройден (advanced в потоке этого модуля) — Ok', async () => {
    env.prerequisite = ok(module);
    env.seedStreams(prevStream());
    env.seedStudents(
      studentState('advanced', {
        uuid: crypto.randomUUID(),
        streamId: OTHER_STREAM,
        steps: [done(STEP_1)],
      }),
    );
    expectOk(await enroll());
  });

  it('not_advanced не «прошёл» — отказ с названием модуля', async () => {
    env.prerequisite = ok(module);
    env.seedStreams(prevStream());
    env.seedStudents(
      studentState('not_advanced', {
        uuid: crypto.randomUUID(),
        streamId: OTHER_STREAM,
        steps: [issued(STEP_1)],
      }),
    );
    const error = expectErr(await enroll(), 'STUDENT_PREREQUISITE_NOT_PASSED');
    expect(error.payload).toEqual({ moduleTitle: 'Основы' });
    expect(error.label).toBe('Сначала пройдите предыдущий модуль');
  });

  it('записей нет — отказ', async () => {
    env.prerequisite = ok(module);
    expectErr(await enroll(), 'STUDENT_PREREQUISITE_NOT_PASSED');
  });
});

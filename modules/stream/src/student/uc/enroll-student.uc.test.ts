import { beforeEach, describe, expect, it } from 'bun:test';
import type { ModulePrerequisite } from '@u7-scl/domain/course/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { type Caller, ok } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { StreamUser } from '../../stream.module';
import { EnrollStudentUc } from './enroll-student.uc';
import {
  done,
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

// Перенос `api/student/enroll-student-uc.test.ts`. Порядок отказов: набор → ключ →
// активная запись (в том числе в этом же потоке) → допуск → нет шагов; курса нет —
// допуск пропускается; набор должен быть открыт (первым). Зачисляется субъект вызова
// роль STUDENT stream не выдаёт. Допуск — вердикт курса (D-65): `passedModuleIds`
// собирает `PassedModulesDqs` из `advanced`-записей и потоков (Т10); сравнений с
// id курса в UC нет. Сценарии «пройден» — `advanced`, `not_advanced`, другой
// модуль, дубли прохождений, ушедшая запись — в `passed-modules.dqs.test.ts`
// (TST-08).

let env: ReturnType<typeof makeEnv>;
const uc = () => new EnrollStudentUc(env.deps, StreamModuleDef);
const enroll = (
  input: { enrollmentKey?: string } = {},
  caller: Caller<StreamUser> = owner,
) => uc().handle({ streamId: STREAM, ...input }, caller, REQ);

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
      ['getModulePrerequisite', { moduleId: MODULE, passedModuleIds: [] }],
    ]);
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
  it('поток не в наборе — STUDENT_ENROLLMENT_CLOSED, студент не создан (матрица статусов — в правиле)', async () => {
    env.seedStreams(streamOf('active'));
    expectErr(await enroll(), 'STUDENT_ENROLLMENT_CLOSED');
    expect(env.ctx.published).toEqual([]);
  });

  it('закрытый набор — раньше кодового слова', async () => {
    env.seedStreams(streamOf('active', { enrollmentKey: 'секрет' }));
    expectErr(
      await enroll({ enrollmentKey: 'нет' }),
      'STUDENT_ENROLLMENT_CLOSED',
    );
  });

  it('потока нет — STREAM_NOT_FOUND { streamId }', async () => {
    const other = '99999999-9999-4999-8999-999999999999';
    const res = await uc().handle({ streamId: other }, owner, REQ);
    const error = expectErr(res, 'STREAM_NOT_FOUND');
    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ streamId: other });
  });

  it('порядок: ключ → активная запись → допуск → нет шагов', async () => {
    const LIVE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    env.seedStreams(
      streamOf('enrollment', { enrollmentKey: 'секрет', contentSnapshot: [] }),
    );
    env.seedStudents(studentState('active', { uuid: LIVE }));
    env.prerequisite = ok({ admitted: false, reason: 'closed' });

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

    env.prerequisite = ok({ admitted: true });
    expectErr(await enroll({ enrollmentKey: 'секрет' }), 'STUDENT_NO_STEPS');
  });
});

describe('EnrollStudentUc — допуск к модулю (вердикт курса)', () => {
  const verdicts: [string, ModulePrerequisite, string][] = [
    ['closed', { admitted: false, reason: 'closed' }, 'предыдущий'],
    [
      'previous-not-passed',
      { admitted: false, reason: 'previous-not-passed', title: 'Основы' },
      'Основы',
    ],
  ];

  it.each(verdicts)(
    '%s — STUDENT_PREREQUISITE_NOT_PASSED { moduleTitle }',
    async (_, verdict, moduleTitle) => {
      env.prerequisite = ok(verdict);

      const error = expectErr(
        await enroll(),
        'STUDENT_PREREQUISITE_NOT_PASSED',
      );

      expect(error.payload).toEqual({ moduleTitle });
    },
  );
});

describe('EnrollStudentUc — passedModuleIds в вызове курса (Т10)', () => {
  const notPassed = {
    admitted: false,
    reason: 'previous-not-passed',
    title: 'Основы',
  } as const;
  const asked = () =>
    env.course.received.map((c) => c.input as { passedModuleIds: string[] });

  it('advanced в потоке предыдущего модуля — модуль в passedModuleIds, допуск есть', async () => {
    env.prerequisite = ok(notPassed);
    env.seedStreams(prevStream());
    env.seedStudents(
      studentState('advanced', {
        uuid: crypto.randomUUID(),
        streamId: OTHER_STREAM,
        steps: [done(STEP_1)],
      }),
    );

    expectOk(await enroll());

    expect(asked().map((i) => i.passedModuleIds)).toEqual([[PREV_MODULE]]);
  });

  it('записей нет — passedModuleIds пуст, отказ', async () => {
    env.prerequisite = ok(notPassed);

    expectErr(await enroll(), 'STUDENT_PREREQUISITE_NOT_PASSED');

    expect(asked().map((i) => i.passedModuleIds)).toEqual([[]]);
  });
});

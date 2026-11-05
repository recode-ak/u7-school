import { beforeEach, describe, expect, it } from 'bun:test';
import type { StudentState } from '@u7-scl/domain/stream';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  DAY,
  done,
  issued,
  makeEnv,
  mentor,
  REQ,
  STEP_1,
  STEP_2,
  STREAM,
  STUDENT,
  streamOf,
  studentState,
  T0,
  USER,
} from '../../student/uc/student-uc.fixture';
import { ActivateStreamUc } from './activate-stream.uc';
import { CompleteStreamUc } from './complete-stream.uc';
import { GetStreamMembersUc } from './get-stream-members.uc';

// Перенос части студента из тестов `activate/complete-stream` и `get-stream-members`
// (Ф1: порт `StreamStudents` + `StudentsFake`) на `StudentRepo`:
// запуск — `StreamLaunchDcs` в одном UoW, завершение — `StreamMembersDqs.facts`,
// состав — `facts` и `roster`.

const U2 = '22222222-2222-4222-8222-222222222222';
const S2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const S3 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
let env: ReturnType<typeof makeEnv>;
const input = { streamId: STREAM };

beforeEach(() => {
  env = makeEnv();
});

describe('ActivateStreamUc — запуск студентов (StreamLaunchDcs, один UoW)', () => {
  const run = () =>
    new ActivateStreamUc(env.deps, StreamModuleDef).handle(input, mentor, REQ);

  beforeEach(() => env.seedStreams(streamOf('enrollment')));

  it('enrolled → active с первым шагом; поток active; всё сохранено', async () => {
    env.seedStudents(studentState('enrolled'));

    expectOk(await run());

    expect(env.streams.restoredOrThrow(STREAM).snapshot().status).toBe(
      'active',
    );
    const student = env.students.restoredOrThrow(STUDENT).snapshot();
    expect(student.status).toBe('active');
    expect(student.steps.map((s) => [s.stepId, s.status])).toEqual([
      [STEP_1, 'issued'],
    ]);
    expect(student.currentStepId).toBe(STEP_1);
    expect(env.streams.saved).toHaveLength(1);
    expect(env.students.saved).toHaveLength(1);
  });

  const noFirstStep: [string, StudentState[]][] = [
    ['студент enrolled в стенде', [studentState('enrolled')]],
    ['студентов нет', []],
  ];

  it.each(noFirstStep)(
    'первого шага нет — поток активен, студенты не записаны (%s)',
    async (_, students) => {
      env.seedStreams(streamOf('enrollment', { contentSnapshot: [] }));
      env.seedStudents(...students);
      expectOk(await run());
      expect(env.streams.restoredOrThrow(STREAM).snapshot().status).toBe(
        'active',
      );
      expect(env.students.saved).toEqual([]);
    },
  );
});

describe('CompleteStreamUc — студенты из StudentRepo', () => {
  const run = () =>
    new CompleteStreamUc(env.deps, StreamModuleDef).handle(input, mentor, REQ);

  beforeEach(() => env.seedStreams(streamOf('active')));

  it('все студенты с исходом — поток завершён', async () => {
    env.seedStudents(
      studentState('abandoned'),
      studentState('advanced', { uuid: S2, userId: U2 }),
    );
    expectOk(await run());
    expect(env.streams.restoredOrThrow(STREAM).snapshot().status).toBe(
      'completed',
    );
  });

  it('студентов нет — завершён', async () => {
    env.seedStudents();
    expectOk(await run());
  });

  it('студент active блокирует: STREAM_STUDENTS_IN_PROGRESS со списком { userId, status }', async () => {
    env.seedStudents(
      studentState('advanced'),
      studentState('active', { uuid: S2, userId: U2 }),
    );
    const error = expectErr(await run(), 'STREAM_STUDENTS_IN_PROGRESS');
    expect(error.payload).toEqual({
      pending: [{ userId: U2, status: 'active' }],
    });
    expect(env.streams.restoredOrThrow(STREAM).snapshot().status).toBe(
      'active',
    );
  });
});

describe('GetStreamMembersUc — состав и roster', () => {
  const ask = (streamId = STREAM) =>
    new GetStreamMembersUc(env.deps, StreamModuleDef).handle(
      { streamId },
      mentor,
      REQ,
    );

  beforeEach(() => env.seedStreams(streamOf('active')));

  it('ментор и факты студентов (без settled)', async () => {
    env.seedStudents(
      studentState('abandoned'),
      studentState('active', { uuid: S2, userId: U2, steps: [done(STEP_1)] }),
    );

    const res = expectOk(await ask());

    expect(res?.mentorId).toBeString();
    expect(res?.students).toEqual([
      {
        studentId: STUDENT,
        userId: USER,
        status: 'abandoned',
        neverStarted: true,
        inProgress: false,
      },
      {
        studentId: S2,
        userId: U2,
        status: 'active',
        neverStarted: false,
        inProgress: true,
      },
    ]);
  });

  it('roster: отставание считается на момент this.now() по всем студентам', async () => {
    const at = (days: number) => T0 - days * DAY;
    env.seedStudents(
      studentState('active', {
        steps: [done(STEP_1, at(9), at(8))],
        currentStepId: STEP_1,
      }),
      studentState('active', {
        uuid: S2,
        userId: U2,
        steps: [issued(STEP_2, T0 - 3_600_000)],
      }),
      studentState('abandoned', {
        uuid: S3,
        steps: [done(STEP_1, at(20), at(19))],
      }),
    );

    const res = expectOk(await ask());

    expect(res?.roster?.map((r) => [r.studentId, r.lagLevel])).toEqual([
      [STUDENT, 'critical'],
      [S2, 'on_track'],
      [S3, 'on_track'],
    ]);
    expect(res?.roster?.[1]?.hoursSinceLastActivity).toBe(1);
  });
});

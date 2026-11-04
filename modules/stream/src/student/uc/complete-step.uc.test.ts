import { beforeEach, describe, expect, it } from 'bun:test';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import type { Caller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { StreamUser } from '../../stream.module';
import { CompleteStepUc } from './complete-step.uc';
import {
  anonymous,
  done,
  issued,
  makeEnv,
  mentor,
  owner,
  REQ,
  STEP_1,
  STEP_2,
  STREAM,
  STUDENT,
  stranger,
  streamOf,
  withStep,
} from './student-uc.fixture';

// Перенос `api/student/complete-step-uc.test.ts`. Студент своё — Policy isSelf
// (Т8: legacy `canCompleteStep` не применялся). «Студент не найден» —
// `not_found`, а не `access` (Т9).

const OTHER_STEP = '99999999-9999-4999-8999-999999999999';
let env: ReturnType<typeof makeEnv>;
const uc = () => new CompleteStepUc(env.deps, StreamModuleDef);
const run = (
  stepId = STEP_1,
  caller: Caller<StreamUser> = owner,
  streamId = STREAM,
) => uc().handle({ studentId: STUDENT, streamId, stepId }, caller, REQ);
const stored = () => env.students.restoredOrThrow(STUDENT).snapshot();

beforeEach(() => {
  env = makeEnv();
  env.seedStreams(streamOf('active'));
  env.seedStudents(withStep());
});

describe('CompleteStepUc', () => {
  it('завершает шаг и выдаёт следующий: level step, запись сохранена', async () => {
    expect(expectOk(await run())).toEqual({
      level: 'step',
      currentStepId: STEP_2,
    });

    expect(stored().steps.map((s) => [s.stepId, s.status])).toEqual([
      [STEP_1, 'completed'],
      [STEP_2, 'issued'],
    ]);
    expect(stored().currentStepId).toBe(STEP_2);
    expect(env.students.saved).toHaveLength(1);
  });

  it('последний шаг потока — level stream, статус студента не меняется', async () => {
    env.seedStudents(
      withStep({
        steps: [done(STEP_1), issued(STEP_2)],
        currentStepId: STEP_2,
      }),
    );
    expect(expectOk(await run(STEP_2))).toEqual({
      level: 'stream',
      completed: true,
    });
    expect(stored().status).toBe('active');
  });

  it('повтор завершённого шага — already_completed, запись не пишется', async () => {
    env.seedStudents(
      withStep({
        steps: [done(STEP_1), issued(STEP_2)],
        currentStepId: STEP_2,
      }),
    );
    expect(expectOk(await run(STEP_1))).toEqual({
      level: 'already_completed',
      currentStepId: STEP_2,
    });
  });

  it('сбрасывает notices (возобновление учёбы)', async () => {
    env.seedStudents(
      withStep({ notices: [{ kind: 'inactivity_warn_student', sentAt: 1 }] }),
    );
    expectOk(await run());
    expect(stored().notices ?? []).toEqual([]);
  });

  it('событий в шину нет', async () => {
    expectOk(await run());
    expect(env.ctx.published).toEqual([]);
  });

  it('студента нет — STUDENT_NOT_FOUND (not_found, Т9)', async () => {
    const error = expectErr(
      await uc().handle(
        {
          studentId: '99999999-9999-4999-8999-999999999999',
          streamId: STREAM,
          stepId: STEP_1,
        },
        owner,
        REQ,
      ),
      'STUDENT_NOT_FOUND',
    );
    expect(error.kind).toBe('not_found');
    expect(error.label).toBe('Студент не найден');
  });

  it('потока нет — STREAM_NOT_FOUND', async () => {
    expectErr(
      await run(STEP_1, owner, '99999999-9999-4999-8999-999999999999'),
      'STREAM_NOT_FOUND',
    );
  });

  it('шага нет в потоке — STUDENT_STEP_NOT_IN_STREAM', async () => {
    const error = expectErr(
      await run(OTHER_STEP),
      'STUDENT_STEP_NOT_IN_STREAM',
    );
    expect(error.label).toBe('Шаг не найден в структуре потока');
  });

  it('шаг не выдан студенту — STUDENT_STEP_NOT_ISSUED', async () => {
    const error = expectErr(await run(STEP_2), 'STUDENT_STEP_NOT_ISSUED');
    expect(error.label).toBe('Нельзя завершить шаг: он не был выдан студенту.');
    expect(env.students.saved).toEqual([]);
  });
});

describe('CompleteStepUc — права (Т8)', () => {
  it.each([
    ['чужой студент', stranger],
    ['ментор потока', mentor],
  ])('%s — ACCESS_DENIED, запись не меняется', async (_, caller) => {
    expectErr(await run(STEP_1, caller), 'ACCESS_DENIED');
    expect(stored()).toEqual(withStep());
    expect(env.students.saved).toEqual([]);
  });

  it('вызывающий guest — UNAUTHORIZED', async () => {
    expectErr(await run(STEP_1, anonymous), 'UNAUTHORIZED');
  });
});

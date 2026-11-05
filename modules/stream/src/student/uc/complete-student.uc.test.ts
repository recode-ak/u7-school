import { beforeEach, describe, expect, it } from 'bun:test';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import type { Caller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { StreamUser } from '../../stream.module';
import { CompleteStudentUc } from './complete-student.uc';
import {
  MODULE,
  makeEnv,
  mentor,
  OTHER_STREAM,
  otherMentor,
  REQ,
  STREAM,
  STUDENT,
  streamOf,
  USER,
  withStep,
} from './student-uc.fixture';

// Перенос `api/student/complete-student-uc.test.ts`. Исход `abandoned` убран
// из команды (теперь `markAbandoned`); уведомления студенту шлёт story.
// Студент должен принадлежать потоку из входа.

let env: ReturnType<typeof makeEnv>;
const uc = () => new CompleteStudentUc(env.deps, StreamModuleDef);
const run = (
  outcome: 'advanced' | 'not_advanced' = 'advanced',
  caller: Caller<StreamUser> = mentor,
  streamId = STREAM,
) => uc().handle({ streamId, studentId: STUDENT, outcome }, caller, REQ);
const stored = () => env.students.restoredOrThrow(STUDENT).snapshot();

beforeEach(() => {
  env = makeEnv();
  env.seedStreams(streamOf('active'));
  env.seedStudents(withStep());
});

describe('CompleteStudentUc', () => {
  it.each(['advanced', 'not_advanced'] as const)(
    'исход %s: статус, nextPreference undecided, событие completed',
    async (outcome) => {
      expect(expectOk(await run(outcome))).toEqual({});

      expect(stored().status).toBe(outcome);
      expect(stored().completionDetails).toEqual({
        nextPreference: 'undecided',
      });
      expect(env.ctx.published.map((e) => [e.name, e.payload])).toEqual([
        [
          'stream.student.completed',
          {
            studentId: STUDENT,
            userId: USER,
            streamId: STREAM,
            moduleId: MODULE,
            outcome,
          },
        ],
      ]);
    },
  );

  it('исход abandoned не принимается — INPUT_VALIDATION', async () => {
    const res = await uc().handle(
      { streamId: STREAM, studentId: STUDENT, outcome: 'abandoned' } as never,
      mentor,
      REQ,
    );

    expectErr(res, 'INPUT_VALIDATION');
    expect(stored().status).toBe('active');
  });

  it('студента нет — STUDENT_NOT_FOUND', async () => {
    const error = expectErr(
      await uc().handle(
        {
          streamId: STREAM,
          studentId: '99999999-9999-4999-8999-999999999999',
          outcome: 'advanced',
        },
        mentor,
        REQ,
      ),
      'STUDENT_NOT_FOUND',
    );
    expect(error.kind).toBe('not_found');
  });

  it('потока нет — STREAM_NOT_FOUND', async () => {
    expectErr(
      await run('advanced', mentor, '99999999-9999-4999-8999-999999999999'),
      'STREAM_NOT_FOUND',
    );
  });

  it('студент из другого потока (не streamId входа) — STUDENT_NOT_FOUND (Т8)', async () => {
    env.seedStreams(streamOf('active', { uuid: OTHER_STREAM }));
    expectErr(await run('advanced', mentor, OTHER_STREAM), 'STUDENT_NOT_FOUND');
    expect(stored().status).toBe('active');
  });
});

describe('CompleteStudentUc — права', () => {
  it('ментор чужого потока — ACCESS_DENIED, запись не меняется', async () => {
    expectErr(await run('advanced', otherMentor), 'ACCESS_DENIED');
    expect(stored().status).toBe('active');
  });
});

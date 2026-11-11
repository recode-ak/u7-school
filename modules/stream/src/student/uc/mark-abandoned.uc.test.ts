import { beforeEach, describe, expect, it } from 'bun:test';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import type { Caller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { StreamUser } from '../../stream.module';
import { MarkAbandonedUc } from './mark-abandoned.uc';
import {
  makeEnv,
  mentor,
  otherMentor,
  REQ,
  STREAM,
  STUDENT,
  streamOf,
  USER,
  withStep,
} from './student-uc.fixture';

// Перенос `api/student/mark-abandoned-uc.test.ts`. Уведомление студенту
// (только `cause = inactivity`) теперь шлёт story по событию abandoned.
// Студент должен принадлежать потоку входа.

let env: ReturnType<typeof makeEnv>;
const uc = () => new MarkAbandonedUc(env.deps, StreamModuleDef);
const run = (
  cause: 'inactivity' | 'by_mentor' = 'inactivity',
  caller: Caller<StreamUser> = mentor,
  streamId = STREAM,
) => uc().handle({ streamId, studentId: STUDENT, cause }, caller, REQ);
const stored = () => env.students.restoredOrThrow(STUDENT).snapshot();

beforeEach(() => {
  env = makeEnv();
  env.seedStreams(streamOf('active'));
  env.seedStudents(withStep());
});

describe('MarkAbandonedUc', () => {
  it.each(['inactivity', 'by_mentor'] as const)(
    'причина %s → abandoned { mentor, cause }, событие abandoned',
    async (cause) => {
      expect(expectOk(await run(cause))).toEqual({});

      expect(stored().status).toBe('abandoned');
      expect(stored().abandonDetails).toEqual({ who: 'mentor', cause });
      expect(env.ctx.published.map((e) => [e.name, e.payload])).toEqual([
        [
          'stream.student.abandoned',
          {
            studentId: STUDENT,
            userId: USER,
            streamId: STREAM,
            who: 'mentor',
            cause,
          },
        ],
      ]);
    },
  );

  it('причина voluntary не принимается — INPUT_VALIDATION', async () => {
    const res = await uc().handle(
      { streamId: STREAM, studentId: STUDENT, cause: 'voluntary' } as never,
      mentor,
      REQ,
    );

    expectErr(res, 'INPUT_VALIDATION');
    expect(stored().status).toBe('active');
  });

  it('студента нет — STUDENT_NOT_FOUND; потока нет — STREAM_NOT_FOUND', async () => {
    expectErr(
      await uc().handle(
        {
          streamId: STREAM,
          studentId: '99999999-9999-4999-8999-999999999999',
          cause: 'by_mentor',
        },
        mentor,
        REQ,
      ),
      'STUDENT_NOT_FOUND',
    );
    expectErr(
      await run('by_mentor', mentor, '99999999-9999-4999-8999-999999999999'),
      'STREAM_NOT_FOUND',
    );
  });
});

describe('MarkAbandonedUc — права', () => {
  it('ментор чужого потока — ACCESS_DENIED, запись не меняется', async () => {
    expectErr(await run('by_mentor', otherMentor), 'ACCESS_DENIED');
    expect(stored().status).toBe('active');
  });
});

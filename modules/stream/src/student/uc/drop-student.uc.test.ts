import { beforeEach, describe, expect, it } from 'bun:test';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import type { Caller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { StreamUser } from '../../stream.module';
import { DropStudentUc } from './drop-student.uc';
import {
  makeEnv,
  owner,
  REQ,
  STREAM,
  STUDENT,
  stranger,
  streamOf,
  studentState,
  USER,
  withStep,
} from './student-uc.fixture';

// Перенос `api/student/drop-student-uc.test.ts`. Самовыход: Policy isSelf
// («Вы не можете выйти из чужого потока»). Уведомление ментору (стори) теперь
// подписано на событие abandoned. Студент должен принадлежать потоку входа.

let env: ReturnType<typeof makeEnv>;
const uc = () => new DropStudentUc(env.deps, StreamModuleDef);
const run = (caller: Caller<StreamUser> = owner, streamId = STREAM) =>
  uc().handle({ streamId, studentId: STUDENT }, caller, REQ);
const stored = () => env.students.restoredOrThrow(STUDENT).snapshot();

beforeEach(() => {
  env = makeEnv();
  env.seedStreams(streamOf('active'));
  env.seedStudents(withStep());
});

describe('DropStudentUc', () => {
  it.each(['enrolled', 'active'] as const)(
    'из %s → abandoned { self, voluntary }, событие abandoned',
    async (status) => {
      env.seedStudents(studentState(status));
      expect(expectOk(await run())).toEqual({});

      expect(stored().status).toBe('abandoned');
      expect(stored().abandonDetails).toEqual({
        who: 'self',
        cause: 'voluntary',
      });
      expect(env.ctx.published.map((e) => [e.name, e.payload])).toEqual([
        [
          'stream.student.abandoned',
          {
            studentId: STUDENT,
            userId: USER,
            streamId: STREAM,
            who: 'self',
            cause: 'voluntary',
          },
        ],
      ]);
    },
  );

  it('студента нет — STUDENT_NOT_FOUND', async () => {
    expectErr(
      await uc().handle(
        { streamId: STREAM, studentId: '99999999-9999-4999-8999-999999999999' },
        owner,
        REQ,
      ),
      'STUDENT_NOT_FOUND',
    );
  });
});

describe('DropStudentUc — права (isSelf)', () => {
  it('чужой студент — ACCESS_DENIED, запись не меняется', async () => {
    expectErr(await run(stranger), 'ACCESS_DENIED');
    expect(stored().status).toBe('active');
  });
});

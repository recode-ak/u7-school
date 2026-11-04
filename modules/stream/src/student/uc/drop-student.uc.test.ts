import { beforeEach, describe, expect, it } from 'bun:test';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import type { Caller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { StreamUser } from '../../stream.module';
import { DropStudentUc } from './drop-student.uc';
import {
  admin,
  anonymous,
  makeEnv,
  mentor,
  OTHER_STREAM,
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
// подписано на событие abandoned. Т8: студент должен принадлежать потоку входа.

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

  it.each(['abandoned', 'advanced', 'not_advanced'] as const)(
    'из %s — STUDENT_NOT_STUDYING «Нельзя снять студента с учёбы: он уже не учится.»',
    async (status) => {
      env.seedStudents(studentState(status));
      const error = expectErr(await run(), 'STUDENT_NOT_STUDYING');
      expect(error.label).toBe(
        'Нельзя снять студента с учёбы: он уже не учится.',
      );
      expect(env.ctx.published).toEqual([]);
      expect(env.students.saved).toEqual([]);
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

  it('студент из другого потока (не streamId входа) — STUDENT_NOT_FOUND (Т8)', async () => {
    expectErr(await run(owner, OTHER_STREAM), 'STUDENT_NOT_FOUND');
    expect(stored().status).toBe('active');
  });
});

describe('DropStudentUc — права (isSelf)', () => {
  it.each([
    ['чужой студент', stranger],
    ['ментор потока', mentor],
    ['админ', admin],
  ])(
    '%s — ACCESS_DENIED «Вы не можете выйти из чужого потока»',
    async (_, caller) => {
      const error = expectErr(await run(caller), 'ACCESS_DENIED');
      expect((error.payload as { denyMessage: string }).denyMessage).toBe(
        'Вы не можете выйти из чужого потока',
      );
      expect(stored().status).toBe('active');
    },
  );

  it('вызывающий guest — UNAUTHORIZED', async () => {
    expectErr(await run(anonymous), 'UNAUTHORIZED');
  });
});

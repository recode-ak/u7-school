import { beforeEach, describe, expect, it } from 'bun:test';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import { MarkAbandonedUc } from './mark-abandoned.uc';
import {
  admin,
  anonymous,
  makeEnv,
  mentor,
  OTHER_STREAM,
  otherMentor,
  owner,
  REQ,
  STREAM,
  STUDENT,
  streamOf,
  studentState,
  USER,
  withStep,
} from './student-uc.fixture';

// Перенос `api/student/mark-abandoned-uc.test.ts`. Уведомление студенту
// (только `cause = inactivity`, Т6) теперь шлёт story по событию abandoned.
// Т8: студент должен принадлежать потоку входа.

let env: ReturnType<typeof makeEnv>;
const uc = () => new MarkAbandonedUc(env.deps, StreamModuleDef);
const run = (
  cause: 'inactivity' | 'by_mentor' = 'inactivity',
  caller = mentor,
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

  it('enrolled тоже снимается', async () => {
    env.seedStudents(studentState('enrolled'));
    expectOk(await run('by_mentor'));
    expect(stored().status).toBe('abandoned');
  });

  it('админ, не ментор потока — Ok', async () => {
    expectOk(await run('by_mentor', admin));
  });

  it.each(['abandoned', 'advanced', 'not_advanced'] as const)(
    'студент в статусе %s — STUDENT_NOT_STUDYING',
    async (status) => {
      env.seedStudents(studentState(status));
      expectErr(await run(), 'STUDENT_NOT_STUDYING');
      expect(env.ctx.published).toEqual([]);
    },
  );

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

  it('студент из другого потока (не streamId входа) — STUDENT_NOT_FOUND (Т8)', async () => {
    env.seedStreams(streamOf('active', { uuid: OTHER_STREAM }));
    expectErr(
      await run('by_mentor', mentor, OTHER_STREAM),
      'STUDENT_NOT_FOUND',
    );
    expect(stored().status).toBe('active');
  });
});

describe('MarkAbandonedUc — права', () => {
  it.each([
    ['ментор чужого потока', otherMentor],
    ['сам студент', owner],
  ])(
    '%s — ACCESS_DENIED «Недостаточно прав для снятия студента с учёбы»',
    async (_, caller) => {
      const error = expectErr(await run('by_mentor', caller), 'ACCESS_DENIED');
      expect((error.payload as { denyMessage: string }).denyMessage).toBe(
        'Недостаточно прав для снятия студента с учёбы',
      );
      expect(stored().status).toBe('active');
    },
  );

  it('вызывающий guest — UNAUTHORIZED', async () => {
    expectErr(await run('by_mentor', anonymous), 'UNAUTHORIZED');
  });
});

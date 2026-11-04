import { beforeEach, describe, expect, it } from 'bun:test';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import { CompleteStudentUc } from './complete-student.uc';
import {
  admin,
  anonymous,
  MODULE,
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

// Перенос `api/student/complete-student-uc.test.ts`. Исход `abandoned` убран
// из команды (теперь `markAbandoned`); уведомления студенту шлёт story.
// Т8: студент должен принадлежать потоку из входа.

let env: ReturnType<typeof makeEnv>;
const uc = () => new CompleteStudentUc(env.deps, StreamModuleDef);
const run = (
  outcome: 'advanced' | 'not_advanced' = 'advanced',
  caller = mentor,
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

  it('смена исхода: advanced ↔ not_advanced разрешена', async () => {
    expectOk(await run('advanced'));
    expectOk(await run('not_advanced'));
    expect(stored().status).toBe('not_advanced');
  });

  it('админ, не ментор потока — Ok', async () => {
    expectOk(await run('advanced', admin));
  });

  it.each(['enrolled', 'abandoned'] as const)(
    'студент в статусе %s — STUDENT_NOT_COMPLETABLE «Нельзя завершить студента: он не учится.»',
    async (status) => {
      env.seedStudents(studentState(status));
      const error = expectErr(await run(), 'STUDENT_NOT_COMPLETABLE');
      expect(error.label).toBe('Нельзя завершить студента: он не учится.');
      expect(env.ctx.published).toEqual([]);
      expect(env.students.saved).toEqual([]);
    },
  );

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
  it.each([
    ['ментор чужого потока', otherMentor],
    ['сам студент', owner],
  ])(
    '%s — ACCESS_DENIED «Недостаточно прав для завершения студента»',
    async (_, caller) => {
      const error = expectErr(await run('advanced', caller), 'ACCESS_DENIED');
      expect((error.payload as { denyMessage: string }).denyMessage).toBe(
        'Недостаточно прав для завершения студента',
      );
      expect(stored().status).toBe('active');
    },
  );

  it('вызывающий guest — UNAUTHORIZED', async () => {
    expectErr(await run('advanced', anonymous), 'UNAUTHORIZED');
  });
});

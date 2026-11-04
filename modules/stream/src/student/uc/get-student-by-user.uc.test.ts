import { beforeEach, describe, expect, it } from 'bun:test';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import { GetStudentByUserUc } from './get-student-by-user.uc';
import {
  makeEnv,
  OTHER_STREAM,
  owner,
  REQ,
  STUDENT,
  studentState,
  USER,
} from './student-uc.fixture';

// Перенос `api/student/get-student-by-user-uc.test.ts`: сначала живая запись
// (enrolled/active), иначе первая терминальная; записей нет — NOT_FOUND.
// Выход — `StudentView`.

const OLD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const LIVE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
let env: ReturnType<typeof makeEnv>;
const ask = (userId = USER) =>
  new GetStudentByUserUc(env.deps, StreamModuleDef).handle(
    { userId },
    owner,
    REQ,
  );

beforeEach(() => {
  env = makeEnv();
});

describe('GetStudentByUserUc', () => {
  it('возвращает живую запись, даже если терминальная лежит раньше', async () => {
    env.seedStudents(
      studentState('advanced', { uuid: OLD, streamId: OTHER_STREAM }),
      studentState('active', { uuid: LIVE }),
    );

    const view = expectOk(await ask());

    expect(view).toMatchObject({
      uuid: LIVE,
      status: 'active',
      inProgress: true,
    });
  });

  it('живой записи нет — первая терминальная', async () => {
    env.seedStudents(
      studentState('advanced', { uuid: OLD, streamId: OTHER_STREAM }),
      studentState('abandoned', { uuid: LIVE }),
    );

    expect(expectOk(await ask())).toMatchObject({
      uuid: OLD,
      status: 'advanced',
    });
  });

  it('вид без notices, с исходом и признаками', async () => {
    env.seedStudents(
      studentState('active', {
        notices: [{ kind: 'inactivity_warn_student', sentAt: 1 }],
      }),
    );
    const view = expectOk(await ask());
    expect('notices' in view).toBe(false);
    expect(view).toMatchObject({
      uuid: STUDENT,
      outcome: { category: 'in_progress', signs: [] },
      enrolled: false,
      passed: false,
    });
  });

  it('записей нет — STUDENT_NOT_FOUND', async () => {
    env.seedStudents();
    const error = expectErr(await ask(), 'STUDENT_NOT_FOUND');
    expect(error.kind).toBe('not_found');
  });

  it('записи другого пользователя не возвращаются', async () => {
    env.seedStudents(studentState('active'));
    expectErr(
      await ask('99999999-9999-4999-8999-999999999999'),
      'STUDENT_NOT_FOUND',
    );
  });

  it('событий и записи нет', async () => {
    env.seedStudents(studentState('active'));
    expectOk(await ask());
    expect(env.ctx.published).toEqual([]);
    expect(env.students.saved).toEqual([]);
  });
});

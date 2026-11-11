import { beforeEach, describe, expect, it } from 'bun:test';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import type { Caller } from 'dmg-core';
import { expectOk } from 'dmg-core/testing';
import type { StreamUser } from '../../stream.module';
import { GetActiveStudentUc } from './get-active-student.uc';
import {
  makeEnv,
  OTHER_STREAM,
  owner,
  REQ,
  STREAM,
  streamOf,
  studentState,
  USER,
} from './student-uc.fixture';

// Новый запрос: первая живая запись пользователя и её поток — для меню
// «Моя учёба» и кнопки «Записаться» (UI считает `canEnroll` по нему).

const LIVE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OLD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let env: ReturnType<typeof makeEnv>;
const ask = (userId = USER, caller: Caller<StreamUser> = owner) =>
  new GetActiveStudentUc(env.deps, StreamModuleDef).handle(
    { userId },
    caller,
    REQ,
  );

beforeEach(() => {
  env = makeEnv();
  env.seedStreams(
    streamOf('active'),
    streamOf('completed', { uuid: OTHER_STREAM }),
  );
});

describe('GetActiveStudentUc', () => {
  it.each(['enrolled', 'active'] as const)(
    'живая запись %s: студент и поток',
    async (status) => {
      env.seedStudents(studentState(status, { uuid: LIVE }));

      const res = expectOk(await ask());

      expect(res.student).toMatchObject({
        uuid: LIVE,
        status,
        inProgress: true,
      });
      expect(res.stream).toMatchObject({ uuid: STREAM, status: 'active' });
    },
  );

  it('берётся первая живая запись, терминальные пропускаются', async () => {
    env.seedStudents(
      studentState('advanced', { uuid: OLD, streamId: OTHER_STREAM }),
      studentState('active', { uuid: LIVE }),
    );

    expect(expectOk(await ask()).student?.uuid).toBe(LIVE);
  });

  it('записей нет — пустой ответ, без ошибки', async () => {
    env.seedStudents();
    expect(expectOk(await ask())).toEqual({});
  });
});

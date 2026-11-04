import { beforeEach, describe, expect, it } from 'bun:test';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { expectOk } from 'dmg-core/testing';
import { GetActiveStudentUc } from './get-active-student.uc';
import {
  anonymous,
  makeEnv,
  OTHER_STREAM,
  owner,
  REQ,
  STREAM,
  streamOf,
  studentState,
  USER,
} from './student-uc.fixture';

// Новый запрос (Т2): первая живая запись пользователя и её поток — для меню
// «Моя учёба» и кнопки «Записаться» (UI считает `canEnroll` по нему).

const LIVE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OLD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
let env: ReturnType<typeof makeEnv>;
const ask = (userId = USER, caller = owner) =>
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

  it('поток без кодового слова в виде: только requiresEnrollmentKey', async () => {
    env.seedStreams(streamOf('active', { enrollmentKey: 'секрет' }));
    env.seedStudents(studentState('active'));

    const { stream } = expectOk(await ask());

    expect(stream?.requiresEnrollmentKey).toBe(true);
    expect(JSON.stringify(stream)).not.toContain('секрет');
  });

  it.each([
    ['записей нет', []],
    [
      'только терминальные',
      [studentState('abandoned'), studentState('advanced', { uuid: OLD })],
    ],
  ])('%s — пустой ответ, без ошибки', async (_, rows) => {
    env.seedStudents(...rows);
    expect(expectOk(await ask())).toEqual({});
  });

  it('доступен гостю (allowAll): ответ тот же', async () => {
    env.seedStudents(studentState('active'));
    expect(expectOk(await ask(USER, anonymous)).student?.userId).toBe(USER);
  });
});

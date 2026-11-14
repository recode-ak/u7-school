import { beforeEach, describe, expect, it } from 'bun:test';
import { GetSnapshotStepsUcDef } from '@u7-scl/domain/course/contract';
import {
  GetStreamLessonStepsUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import { type Caller, ok } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { StreamUser } from '../../stream.module';
import {
  admin,
  makeEnv,
  mentor,
  owner,
  REQ,
  STEP_1,
  STEP_2,
  STREAM,
  stranger,
  streamOf,
  studentState,
} from '../../student/uc/student-uc.fixture';
import { GetStreamLessonStepsUc } from './get-stream-lesson-steps.uc';

// Ф4а, сценарий 7. Описания шагов уроков потока по снимку, включая шаги,
// снятые с публикации в курсе. Предполагаемый контракт:
// `GetStreamLessonStepsUcDef` ('getStreamLessonSteps', `type: 'query'`,
// `callers: ['user']`), вход `{ streamId, lessonIds }`, выход как у
// `getStepsByLessons`: `{ [lessonId]: [{ uuid, description, status }] }`
// в порядке stepIds снимка; урока вне снимка в ответе нет. Доступ — как у
// `getStreamStep`. Снимок фикстуры: урок LESSON → [STEP_1, STEP_2].

const LESSON = '22222222-2222-4222-8222-222222222222';
const OUTSIDE_LESSON = '99999999-9999-4999-8999-999999999992';

let env: ReturnType<typeof makeEnv>;
beforeEach(() => {
  env = makeEnv();
  env.seedStreams(streamOf('active'));
  env.seedStudents(studentState('active'));
  env.course.answer(GetSnapshotStepsUcDef, ({ stepIds }) =>
    ok(
      stepIds.map(
        (id, i) =>
          ({
            uuid: id,
            moduleId: '3f2e1d0c-9b8a-4765-8432-10fedcba9876',
            kind: 'text',
            description: `Описание ${id.slice(0, 2)}`,
            content: 'Текст',
            status: i === 0 ? 'draft' : 'archived',
            createdAt: 0,
            updatedAt: 0,
            version: 0,
          }) as never,
      ),
    ),
  );
});

const ask = (
  lessonIds: string[],
  caller: Caller<StreamUser> = owner,
  streamId = STREAM,
) =>
  new GetStreamLessonStepsUc(env.deps, StreamModuleDef).handle(
    { streamId, lessonIds },
    caller,
    REQ,
  );

describe('GetStreamLessonStepsUc', () => {
  it('студент без выданных шагов (все locked) получает описания всех шагов урока — заголовки без замка', async () => {
    env.seedStudents(studentState('enrolled', { steps: [] }));

    const result = expectOk(await ask([LESSON]));

    expect(result[LESSON]?.map((s) => [s.uuid, s.description])).toEqual([
      [STEP_1, 'Описание 33'],
      [STEP_2, 'Описание 44'],
    ]);
  });

  it.each(['abandoned', 'advanced', 'not_advanced'] as const)(
    'студент со статусом записи %s получает описания всех шагов',
    async (status) => {
      env.seedStudents(studentState(status, { steps: [] }));

      expect(expectOk(await ask([LESSON]))[LESSON]).toHaveLength(2);
    },
  );

  it('студент потока: все шаги урока из снимка, включая draft и archived, в порядке снимка', async () => {
    const result = expectOk(await ask([LESSON]));

    expect(result[LESSON]?.map((s) => s.uuid)).toEqual([STEP_1, STEP_2]);
    expect(result[LESSON]?.[0]).toEqual({
      uuid: STEP_1,
      description: 'Описание 33',
      status: 'draft',
    });
    expect(result[LESSON]?.[1]?.status).toBe('archived');
  });

  it('урок вне снимка в ответе отсутствует', async () => {
    const result = expectOk(await ask([OUTSIDE_LESSON, LESSON]));

    expect(Object.keys(result)).toEqual([LESSON]);
  });

  it('курс спрашивается одним запросом по stepIds запрошенных уроков', async () => {
    await ask([LESSON]);

    expect(env.course.received).toHaveLength(1);
    expect(env.course.received[0]?.input).toEqual({
      stepIds: [STEP_1, STEP_2],
    });
  });

  it.each([
    ['ментор потока', mentor],
    ['администратор', admin],
  ])('%s видит шаги', async (_, caller) => {
    expect(expectOk(await ask([LESSON], caller))[LESSON]).toHaveLength(2);
  });

  it('пользователь без записи в потоке — ACCESS_DENIED, курс не спрашивается', async () => {
    expectErr(await ask([LESSON], stranger), 'ACCESS_DENIED');
    expect(env.course.received).toEqual([]);
  });

  it('потока нет — STREAM_NOT_FOUND', async () => {
    const other = '99999999-9999-4999-8999-999999999999';

    expectErr(await ask([LESSON], owner, other), 'STREAM_NOT_FOUND');
  });

  it('Def: query только для пользователя', () => {
    expect(GetStreamLessonStepsUcDef.type).toBe('query');
    expect(GetStreamLessonStepsUcDef.callers).toEqual(['user']);
  });
});

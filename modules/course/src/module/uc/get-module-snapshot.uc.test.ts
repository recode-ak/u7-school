import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { userSubject } from '@u7-scl/domain/user/testing';
import { SystemCaller, UserCaller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  AUTHOR_ID,
  anonymous,
  LESSON_1,
  lessonState,
  MODULE,
  makeContentEnv,
  moduleState,
  otherMentor,
  PROJECT_PUBLISHED,
  projectState,
  REQ,
  STEP_1,
  STEP_2,
  STEP_3,
  student,
  textStep,
} from '../../content-uc.fixture';
import type { CourseUser } from '../../course.module';
import { GetModuleSnapshotUc } from './get-module-snapshot.uc';

// Ответственность UC: доступ к модулю через Policy, отказы, чтение уроков и
// шагов по одному запросу, warn о пропущенном. Правила сборки снимка — на
// уровне `ModuleSnapshotDqs` (TST-08). Ф4а: снимок без неопубликованных
// шагов, пропуск — `logger.warn`; LogRecord пакета без meta, поэтому moduleId
// и id пропущенного проверяются по тексту сообщения.

const PROJECT_2 = '88888888-8888-4888-8888-888888888881';
const MISSING = '99999999-9999-4999-8999-999999999990';

let env: ReturnType<typeof makeContentEnv>;
beforeEach(() => {
  env = makeContentEnv();
});

const uc = () => new GetModuleSnapshotUc(env.deps, CourseModuleDef);
const snapshot = (
  caller: Parameters<GetModuleSnapshotUc['handle']>[1],
  moduleId = MODULE,
) => uc().handle({ moduleId }, caller, REQ);

/** Опубликованный модуль с опубликованным проектом из урока 1 (шаги 1, 2). */
function seedPublished() {
  env.modules.seed(
    moduleState('published', { projects: [projectState('published')] }),
  );
  env.lessons.seed(
    lessonState(LESSON_1, 'published', {
      title: 'Урок 1',
      stepIds: [STEP_1, STEP_2],
    }),
  );
  env.steps.seed(textStep(STEP_1, 'published'), textStep(STEP_2, 'published'));
}

const warns = () => env.ctx.logs.filter((r) => r.level === 'warn');

/** `system`-вызов от имени человека (ментор `createStream`). */
const asSystemFor = (person: UserCaller<CourseUser>) =>
  new SystemCaller(
    { kind: 'useCase', module: 'stream', name: 'createStream' },
    person,
  );

describe('GetModuleSnapshotUc — успех', () => {
  it('снимок: проекты → уроки → stepIds (как есть)', async () => {
    seedPublished();

    expect(expectOk(await snapshot(anonymous))).toEqual([
      {
        projectId: PROJECT_PUBLISHED,
        projectTitle: 'Проект 1',
        lessons: [
          {
            lessonId: LESSON_1,
            lessonTitle: 'Урок 1',
            stepIds: [STEP_1, STEP_2],
          },
        ],
      },
    ]);
  });

  it('гость получает снимок опубликованного модуля', async () => {
    seedPublished();

    expect(expectOk(await snapshot(anonymous))).toHaveLength(1);
  });

  it('system от имени автора модуля получает снимок черновика (Т1: субъект — person)', async () => {
    env.modules.seed(
      moduleState('draft', { projects: [projectState('published')] }),
    );
    env.lessons.seed(lessonState(LESSON_1, 'published'));
    const mentor = new UserCaller(
      userSubject({ uuid: AUTHOR_ID, roles: ['GUEST'] }),
    );

    expect(expectOk(await snapshot(asSystemFor(mentor)))).toHaveLength(1);
  });

  it('system от имени ментора (роль), не автора, снимок черновика не получает — ACCESS_DENIED (пересмотр Ф4а)', async () => {
    env.modules.seed(
      moduleState('draft', { projects: [projectState('published')] }),
    );
    env.lessons.seed(lessonState(LESSON_1, 'published'));

    expectErr(await snapshot(asSystemFor(otherMentor)), 'ACCESS_DENIED');
  });

  it('уроки запрашиваются одним запросом без повторов', async () => {
    env.modules.seed(
      moduleState('published', {
        projects: [
          projectState('published'),
          { ...projectState('published'), uuid: PROJECT_2 },
        ],
      }),
    );
    env.lessons.seed(lessonState(LESSON_1, 'published'));

    await snapshot(anonymous);

    expect(env.asked.lessons).toHaveLength(1);
    expect(new Set(env.asked.lessons[0]).size).toBe(
      env.asked.lessons[0]?.length ?? -1,
    );
    expect(env.asked.lessonById).toEqual([]);
  });

  it('шаги читаются одним запросом по всем stepIds без повторов (Ф4а)', async () => {
    seedPublished();

    await snapshot(anonymous);

    expect(env.asked.steps).toHaveLength(1);
    expect([...(env.asked.steps[0] ?? [])].sort()).toEqual(
      [STEP_1, STEP_2].sort(),
    );
    expect(env.asked.stepById).toEqual([]);
  });
});

describe('GetModuleSnapshotUc — пропуск неопубликованного (Ф4а)', () => {
  it('draft-шаг не попадает в снимок, warn назван moduleId и stepId', async () => {
    seedPublished();
    env.steps.seed(textStep(STEP_2, 'draft'));

    const result = expectOk(await snapshot(anonymous));

    expect(result[0]?.lessons[0]?.stepIds).toEqual([STEP_1]);
    expect(warns()).toHaveLength(1);
    expect(warns()[0]?.message).toContain(MODULE);
    expect(warns()[0]?.message).toContain(STEP_2);
  });

  it('archived-шаг пропускается так же, как draft', async () => {
    seedPublished();
    env.steps.seed(textStep(STEP_1, 'archived'));

    const result = expectOk(await snapshot(anonymous));

    expect(result[0]?.lessons[0]?.stepIds).toEqual([STEP_2]);
    expect(warns()[0]?.message).toContain(STEP_1);
  });

  it('draft-урок опубликованного проекта пропущен, warn назван moduleId и lessonId', async () => {
    seedPublished();
    env.lessons.seed(lessonState(LESSON_1, 'draft', { stepIds: [STEP_1] }));

    const result = expectOk(await snapshot(anonymous));

    expect(result[0]?.lessons).toEqual([]);
    expect(warns()).toHaveLength(1);
    expect(warns()[0]?.message).toContain(MODULE);
    expect(warns()[0]?.message).toContain(LESSON_1);
  });

  it('по warn на каждый пропуск: два шага — две записи', async () => {
    seedPublished();
    env.steps.seed(textStep(STEP_1, 'draft'), textStep(STEP_2, 'draft'));

    expectOk(await snapshot(anonymous));

    expect(warns()).toHaveLength(2);
  });

  it('без пропусков warn нет', async () => {
    seedPublished();

    expectOk(await snapshot(anonymous));

    expect(warns()).toEqual([]);
  });

  it('снимок для ментора (роль), не автора, тот же и warn тот же — права не влияют на состав', async () => {
    seedPublished();
    env.steps.seed(textStep(STEP_2, 'draft'));

    const forGuest = expectOk(await snapshot(anonymous));
    const forMentor = expectOk(await snapshot(otherMentor));

    expect(forMentor).toEqual(forGuest);
  });

  it('шаг, которого нет в репозитории, в снимок не попадает', async () => {
    seedPublished();
    env.lessons.seed(
      lessonState(LESSON_1, 'published', { stepIds: [STEP_1, STEP_3] }),
    );

    const result = expectOk(await snapshot(anonymous));

    expect(result[0]?.lessons[0]?.stepIds).toEqual([STEP_1]);
  });
});

describe('GetModuleSnapshotUc — отказы', () => {
  it('модуля нет — MODULE_NOT_FOUND (ModuleErrors.NOT_FOUND, Т8), kind not_found', async () => {
    const error = expectErr(
      await snapshot(anonymous, MISSING),
      'MODULE_NOT_FOUND',
    );

    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ moduleId: MISSING });
  });

  it('гость на черновом модуле — ACCESS_DENIED (canSeeUnpublished)', async () => {
    env.modules.seed(
      moduleState('draft', { projects: [projectState('published')] }),
    );
    env.lessons.seed(lessonState(LESSON_1, 'published'));

    const error = expectErr(await snapshot(anonymous), 'ACCESS_DENIED');

    expect(error.kind).toBe('access');
    expect(error.payload).toMatchObject({ rule: 'canSeeUnpublished' });
  });

  it('system от имени студента (GUEST) на черновом модуле — ACCESS_DENIED', async () => {
    env.modules.seed(
      moduleState('draft', { projects: [projectState('published')] }),
    );
    env.lessons.seed(lessonState(LESSON_1, 'published'));

    const error = expectErr(
      await snapshot(asSystemFor(student)),
      'ACCESS_DENIED',
    );

    expect(error.payload).toMatchObject({ rule: 'canSeeUnpublished' });
  });

  it('при отказе в доступе уроки не читаются', async () => {
    env.modules.seed(
      moduleState('draft', { projects: [projectState('published')] }),
    );
    env.lessons.seed(lessonState(LESSON_1, 'published'));

    expectErr(await snapshot(anonymous), 'ACCESS_DENIED');

    expect(env.asked.lessons).toEqual([]);
  });

  it('сбой репозитория модулей — SERVER_INTERNAL, а не MODULE_NOT_FOUND', async () => {
    env.modules.findById = async () => {
      throw new Error('диск недоступен');
    };

    expectErr(await snapshot(anonymous), 'SERVER_INTERNAL');
  });
});

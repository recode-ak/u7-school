import { beforeEach, describe, expect, it } from 'bun:test';
import {
  CourseModuleDef,
  GetModuleSnapshotUcDef,
} from '@u7-scl/domain/course/contract';
import { SystemCaller, UserCaller } from 'dmg-core';
import { ModuleFacade } from 'dmg-core/app';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  AUTHOR_ID,
  admin,
  anonymous,
  author,
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
  student,
  system,
} from '../../content-uc.fixture';
import { type CourseUser, createCourseModule } from '../../course.module';
import { GetModuleSnapshotUc } from './get-module-snapshot.uc';

// Ответственность UC: доступ к модулю через Policy, отказы, чтение только
// одним запросом, `facade.serves`. Правила сборки снимка — на уровне
// `ModuleSnapshotDqs` (TST-08).

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
}

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

  it.each([
    ['гость', anonymous],
    ['студент', student],
    ['автор', author],
    ['администратор', admin],
    ['система без человека', system],
  ] as const)(
    '%s получает снимок опубликованного модуля',
    async (_, caller) => {
      seedPublished();
      expect(expectOk(await snapshot(caller))).toHaveLength(1);
    },
  );

  it('автор и администратор черновика получают снимок опубликованной части, а не черновики', async () => {
    env.modules.seed(
      moduleState('draft', {
        projects: [projectState('published'), projectState('draft')],
      }),
    );
    env.lessons.seed(lessonState(LESSON_1, 'published', { stepIds: [STEP_1] }));

    for (const caller of [author, admin]) {
      const result = expectOk(await snapshot(caller));
      expect(result.map((p) => p.projectId)).toEqual([PROJECT_PUBLISHED]);
    }
  });

  it('system от имени автора модуля получает снимок черновика (Т1: субъект — person)', async () => {
    env.modules.seed(
      moduleState('draft', { projects: [projectState('published')] }),
    );
    env.lessons.seed(lessonState(LESSON_1, 'published'));
    const mentor = new UserCaller({ uuid: AUTHOR_ID, roles: [] });

    expect(expectOk(await snapshot(asSystemFor(mentor)))).toHaveLength(1);
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

  it('шаги не читаются (С1)', async () => {
    seedPublished();

    await snapshot(anonymous);

    expect(env.asked.steps).toEqual([]);
    expect(env.asked.stepById).toEqual([]);
  });

  it('только читает: ничего не записывается', async () => {
    seedPublished();
    await snapshot(anonymous);
    expect(env.modules.saved).toEqual([]);
    expect(env.lessons.saved).toEqual([]);
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

  it.each([
    ['гость, черновой модуль', anonymous, 'draft'],
    ['студент, черновой модуль', student, 'draft'],
    ['чужой ментор, черновой модуль', otherMentor, 'draft'],
    ['гость, archived модуль', anonymous, 'archived'],
    ['студент, archived модуль', student, 'archived'],
  ] as const)(
    '%s — ACCESS_DENIED «Нет доступа к модулю»',
    async (_, caller, status) => {
      env.modules.seed(
        moduleState(status, { projects: [projectState('published')] }),
      );
      env.lessons.seed(lessonState(LESSON_1, 'published'));

      const error = expectErr(await snapshot(caller), 'ACCESS_DENIED');

      expect(error.kind).toBe('access');
      expect(error.payload).toMatchObject({
        rule: 'canSeeUnpublished',
        denyMessage: 'Нет доступа к модулю',
      });
    },
  );

  it('system от имени ментора, не автора, на черновом модуле — ACCESS_DENIED', async () => {
    env.modules.seed(
      moduleState('draft', { projects: [projectState('published')] }),
    );
    env.lessons.seed(lessonState(LESSON_1, 'published'));

    const error = expectErr(
      await snapshot(asSystemFor(otherMentor)),
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

  it('сбой репозитория уроков — SERVER_INTERNAL', async () => {
    seedPublished();
    env.lessons.findByIds = async () => {
      throw new Error('диск недоступен');
    };

    expectErr(await snapshot(anonymous), 'SERVER_INTERNAL');
  });

  it('неверный uuid во входе — INPUT_VALIDATION', async () => {
    expectErr(await snapshot(anonymous, 'not-a-uuid'), 'INPUT_VALIDATION');
  });
});

describe('модуль курсов обслуживает getModuleSnapshot', () => {
  it('facade.serves — true; вызов через фасад от system отдаёт снимок', async () => {
    seedPublished();
    const facade = new ModuleFacade(createCourseModule(env.deps));

    expect(facade.serves(GetModuleSnapshotUcDef)).toBe(true);
    const res = await facade.handle(
      GetModuleSnapshotUcDef,
      { moduleId: MODULE },
      system,
      REQ,
    );
    expect(expectOk(res)).toHaveLength(1);
  });
});

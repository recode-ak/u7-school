import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  M1,
  M2,
  makeCourseEnv,
  plainCourse,
  REQ,
  student,
  system,
} from './course-uc.fixture';
import { GetModulePrerequisiteUc } from './get-module-prerequisite.uc';

// Загрузка читает все курсы (без фильтра) и модули, вердикт считает
// `ModulePrerequisiteDqs` в `execute`. Правила вердикта — допуск,
// previous-not-passed, closed, выбор курса, фикстурные случаи — в
// `domain/src/course/module-prerequisite.dqs.test.ts` (TST-08).

const C1 = '44444444-4444-4444-8444-444444444441';

let env: ReturnType<typeof makeCourseEnv>;
beforeEach(() => {
  env = makeCourseEnv();
  env.seedModules(env.moduleWithTitle(M1), env.moduleWithTitle(M2));
});

const uc = () => new GetModulePrerequisiteUc(env.deps, CourseModuleDef);
const ask = (moduleId: string, passedModuleIds: string[] = []) =>
  uc().handle({ moduleId, passedModuleIds }, system, REQ);

describe('getModulePrerequisite — чтение', () => {
  it('курсы читаются все: без фильтра по статусу и автору', async () => {
    env.seedCourses(plainCourse(C1, [M1, M2], 'archived'));

    await ask(M2);

    expect(env.asked.filters).toEqual([undefined]);
  });

  it('модули читаются отдельным запросом', async () => {
    env.seedCourses(plainCourse(C1, [M1, M2]));
    const readAll = env.modules.findAll.bind(env.modules);
    let reads = 0;
    env.modules.findAll = async () => {
      reads += 1;
      return readAll();
    };

    await ask(M2);

    expect(reads).toBe(1);
  });

  it('только читает: ничего не записывается', async () => {
    env.seedCourses(plainCourse(C1, [M1, M2]));
    await ask(M2);
    expect(env.courses.saved).toEqual([]);
    expect(env.modules.saved).toEqual([]);
  });
});

describe('getModulePrerequisite — сквозной сценарий вердикта', () => {
  it('без пройденного предыдущего — previous-not-passed с его названием; с пройденным — admitted', async () => {
    env.seedCourses(plainCourse(C1, [M1, M2]));

    expect(expectOk(await ask(M2))).toEqual({
      admitted: false,
      reason: 'previous-not-passed',
      title: 'Модуль 11',
    });
    expect(expectOk(await ask(M2, [M1]))).toEqual({ admitted: true });
  });
});

describe('getModulePrerequisite — вход и вызывающий', () => {
  it('вызывающий user не допущен (callers: system) — UNAUTHORIZED', async () => {
    const res = await uc().handle(
      { moduleId: M1, passedModuleIds: [] },
      student as never,
      REQ,
    );

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'user',
    });
  });

  it('без passedModuleIds — INPUT_VALIDATION', async () => {
    const res = await uc().handle({ moduleId: M1 } as never, system, REQ);

    expectErr(res, 'INPUT_VALIDATION');
  });

  it('moduleId не uuid — INPUT_VALIDATION', async () => {
    expectErr(await ask('not-a-uuid'), 'INPUT_VALIDATION');
  });

  it('сбой репозитория курсов — SERVER_INTERNAL', async () => {
    env.courses.findAll = async () => {
      throw new Error('диск недоступен');
    };

    expectErr(await ask(M2), 'SERVER_INTERNAL');
  });
});

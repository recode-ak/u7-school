import { beforeEach, describe, expect, it } from 'bun:test';
import {
  CourseModuleDef,
  GetModulePrerequisiteUcDef,
} from '@u7-scl/domain/course/contract';
import { ModuleFacade } from 'dmg-core/app';
import { expectErr, expectOk } from 'dmg-core/testing';
import { createCourseModule } from '../../course.module';
import {
  A0,
  A1,
  CCCC,
  courseState,
  FAFA,
  M1,
  M2,
  M3,
  makeCourseEnv,
  OUTSIDE,
  phase,
  plainCourse,
  REQ,
  student,
  system,
} from './course-uc.fixture';
import { GetModulePrerequisiteUc } from './get-module-prerequisite.uc';

// Переписан с адаптера над legacy (`getCourseByModuleId` + `getPrevModuleId`)
// на вердикт (D-65, Р6): курса нет → `admitted`; входной модуль → `admitted`;
// предыдущий в `passedModuleIds` → `admitted`; иначе `previous-not-passed` с
// названием предыдущего модуля; записи предыдущего модуля нет → `closed` (Т6,
// вместо подмены названия id). Курс — первый в файле, любой статус (Т18).
// Правила вердикта — `ModulePrerequisiteDqs`; здесь — загрузка и вызывающие.

const C1 = '44444444-4444-4444-8444-444444444441';
const C2 = '44444444-4444-4444-8444-444444444442';

let env: ReturnType<typeof makeCourseEnv>;
beforeEach(() => {
  env = makeCourseEnv();
  env.seedModules(
    env.moduleWithTitle(M1),
    env.moduleWithTitle(M2),
    env.moduleWithTitle(M3),
  );
});

const uc = () => new GetModulePrerequisiteUc(env.deps, CourseModuleDef);
const ask = (moduleId: string, passedModuleIds: string[] = []) =>
  uc().handle({ moduleId, passedModuleIds }, system, REQ);

describe('getModulePrerequisite — допущен', () => {
  it('курса с этим модулем нет — admitted', async () => {
    expect(expectOk(await ask(M2))).toEqual({ admitted: true });
  });

  it('модуль вне программы существующих курсов — admitted', async () => {
    env.seedCourses(plainCourse(C1, [M1, M2]));

    expect(expectOk(await ask(OUTSIDE))).toEqual({ admitted: true });
  });

  it('первый модуль курса — admitted', async () => {
    env.seedCourses(plainCourse(C1, [M1, M2]));

    expect(expectOk(await ask(M1))).toEqual({ admitted: true });
  });

  it('предыдущий модуль в passedModuleIds — admitted', async () => {
    env.seedCourses(plainCourse(C1, [M1, M2]));

    expect(expectOk(await ask(M2, [M1]))).toEqual({ admitted: true });
  });

  it('предыдущий ищется через границу этапов', async () => {
    env.seedCourses(
      courseState('published', {
        uuid: C1,
        moduleIds: [M1, M2, M3],
        phases: [phase('А', M1), phase('Б', M3)],
      }),
    );

    expect(expectOk(await ask(M3, [M2]))).toEqual({ admitted: true });
  });
});

describe('getModulePrerequisite — previous-not-passed', () => {
  beforeEach(() => {
    env.seedCourses(plainCourse(C1, [M1, M2, M3]));
  });

  it('второй модуль, пройденных нет — отказ с названием предыдущего', async () => {
    expect(expectOk(await ask(M2))).toEqual({
      admitted: false,
      reason: 'previous-not-passed',
      title: 'Модуль 11',
    });
  });

  it('пройден другой модуль, но не предыдущий — отказ', async () => {
    expect(expectOk(await ask(M3, [M1]))).toEqual({
      admitted: false,
      reason: 'previous-not-passed',
      title: 'Модуль 22',
    });
  });
});

describe('getModulePrerequisite — closed (Т6)', () => {
  it('записи предыдущего модуля нет — closed, а не название-id (прежняя подмена)', async () => {
    env.seedCourses(plainCourse(C1, [OUTSIDE, M2]));

    expect(expectOk(await ask(M2))).toEqual({
      admitted: false,
      reason: 'closed',
    });
  });

  it('предыдущий пройден — запись модуля не нужна, admitted', async () => {
    env.seedCourses(plainCourse(C1, [OUTSIDE, M2]));

    expect(expectOk(await ask(M2, [OUTSIDE]))).toEqual({ admitted: true });
  });
});

describe('getModulePrerequisite — какой курс решает (Т18)', () => {
  it('первый в порядке файла, статус не важен: архивный перед опубликованным', async () => {
    env.seedCourses(
      plainCourse(C1, [M1, M2], 'archived'),
      plainCourse(C2, [M2]),
    );

    expect(expectOk(await ask(M2))).toMatchObject({
      admitted: false,
      reason: 'previous-not-passed',
    });
  });

  it('опубликованный перед архивным — по нему и решение', async () => {
    env.seedCourses(
      plainCourse(C2, [M2]),
      plainCourse(C1, [M1, M2], 'archived'),
    );

    expect(expectOk(await ask(M2))).toEqual({ admitted: true });
  });

  it('фикстурный случай С2: a1a1… — fafa… первым, a0a0… не пройден → отказ (в cccc… он входной)', async () => {
    env.seedModules(env.moduleWithTitle(A0, 'Синтаксис'));
    env.seedCourses(
      courseState('published', {
        uuid: FAFA,
        moduleIds: [A0, A1],
        phases: [phase('Синтаксис', A0), phase('Алгоритмика', A1)],
      }),
      plainCourse(CCCC, [A1]),
    );

    expect(expectOk(await ask(A1))).toEqual({
      admitted: false,
      reason: 'previous-not-passed',
      title: 'Синтаксис',
    });
    expect(expectOk(await ask(A1, [A0]))).toEqual({ admitted: true });
  });

  it('фикстурный случай С2: cccc… первым — a1a1… входной, admitted', async () => {
    env.seedCourses(
      plainCourse(CCCC, [A1]),
      courseState('published', {
        uuid: FAFA,
        moduleIds: [A0, A1],
        phases: [phase('Синтаксис', A0), phase('Алгоритмика', A1)],
      }),
    );

    expect(expectOk(await ask(A1))).toEqual({ admitted: true });
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

  it('только читает: ничего не записывается', async () => {
    env.seedCourses(plainCourse(C1, [M1, M2]));
    await ask(M2);
    expect(env.courses.saved).toEqual([]);
    expect(env.modules.saved).toEqual([]);
  });

  it('модуль курсов обслуживает getModulePrerequisite', () => {
    const facade = new ModuleFacade(createCourseModule(env.deps));
    expect(facade.serves(GetModulePrerequisiteUcDef)).toBe(true);
  });
});

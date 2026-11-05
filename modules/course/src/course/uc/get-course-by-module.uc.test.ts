import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  anonymous,
  courseState,
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
import { GetCourseByModuleUc } from './get-course-by-module.uc';

// Перенос `api/course/get-course-by-module-uc.test.ts` (3): курс, содержащий
// модуль; любой статус (архивный находится); модуль вне курсов — пусто.
// Правило «какой курс у модуля» и порядок файла — `ModuleCoursesDqs`
// (`module-courses.dqs.test.ts`, TST-08).

const C1 = '44444444-4444-4444-8444-444444444441';
const C2 = '44444444-4444-4444-8444-444444444442';

let env: ReturnType<typeof makeCourseEnv>;
beforeEach(() => {
  env = makeCourseEnv();
});

const uc = () => new GetCourseByModuleUc(env.deps, CourseModuleDef);
const byModule = (
  moduleId: string,
  caller: Parameters<GetCourseByModuleUc['handle']>[1] = student,
) => uc().handle({ moduleId }, caller, REQ);

describe('GetCourseByModuleUc — успех', () => {
  it('возвращает курс, содержащий модуль', async () => {
    env.seedCourses(plainCourse(C1, [M1]), plainCourse(C2, [M2]));

    expect(expectOk(await byModule(M2))?.uuid).toBe(C2);
  });

  it('курс в любом статусе (архивный и черновой тоже находятся)', async () => {
    env.seedCourses(plainCourse(C1, [M1], 'archived'));
    expect(expectOk(await byModule(M1))?.uuid).toBe(C1);

    env = makeCourseEnv();
    env.seedCourses(plainCourse(C2, [M2], 'draft'));
    expect(expectOk(await byModule(M2))?.uuid).toBe(C2);
  });

  it('модуль вне курсов — пусто, не ошибка', async () => {
    env.seedCourses(plainCourse(C1, [M1]));

    expect(expectOk(await byModule(OUTSIDE))).toBeUndefined();
  });

  it('курсов нет — пусто', async () => {
    expect(expectOk(await byModule(M1))).toBeUndefined();
  });

  it('курс отдаётся представлением со stages', async () => {
    env.seedCourses(
      courseState('published', {
        uuid: C1,
        moduleIds: [M1, M2, M3],
        phases: [phase('Синтаксис', M1), phase('Алгоритмика', M3)],
      }),
    );

    expect(expectOk(await byModule(M2))?.stages).toEqual([
      { title: 'Синтаксис', moduleIds: [M1, M2] },
      { title: 'Алгоритмика', moduleIds: [M3] },
    ]);
  });

  it('гость и пользователь допущены', async () => {
    env.seedCourses(plainCourse(C1, [M1]));

    expect(expectOk(await byModule(M1, anonymous))?.uuid).toBe(C1);
    expect(expectOk(await byModule(M1, student))?.uuid).toBe(C1);
  });

  it('только читает: ничего не записывается', async () => {
    env.seedCourses(plainCourse(C1, [M1]));
    await byModule(M1);
    expect(env.courses.saved).toEqual([]);
  });
});

describe('GetCourseByModuleUc — вход и вызывающий', () => {
  it('moduleId не uuid — INPUT_VALIDATION', async () => {
    expectErr(await byModule('not-a-uuid'), 'INPUT_VALIDATION');
  });

  it('вызывающий system не допущен (callers: user, guest) — UNAUTHORIZED', async () => {
    const res = await uc().handle({ moduleId: M1 }, system as never, REQ);

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'system',
    });
  });

  it('сбой репозитория — SERVER_INTERNAL', async () => {
    env.courses.findAll = async () => {
      throw new Error('диск недоступен');
    };

    expectErr(await byModule(M1), 'SERVER_INTERNAL');
  });
});

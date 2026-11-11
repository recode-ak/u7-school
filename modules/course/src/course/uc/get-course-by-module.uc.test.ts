import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectOk } from 'dmg-core/testing';
import {
  M1,
  M2,
  makeCourseEnv,
  plainCourse,
  REQ,
  student,
} from './course-uc.fixture';
import { GetCourseByModuleUc } from './get-course-by-module.uc';

// Перенос `api/course/get-course-by-module-uc.test.ts` (3): курс, содержащий
// модуль, — любого статуса. Правило «какой курс у модуля» и порядок файла —
// `ModuleCoursesDqs` (`module-courses.dqs.test.ts`), представление курса —
// `CourseAr.view`, TST-08.

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
});

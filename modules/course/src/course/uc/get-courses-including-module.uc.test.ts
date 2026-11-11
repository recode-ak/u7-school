import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectOk } from 'dmg-core/testing';
import {
  M1,
  M2,
  makeCourseEnv,
  plainCourse,
  REQ,
  system,
} from './course-uc.fixture';
import { GetCoursesIncludingModuleUc } from './get-courses-including-module.uc';

// Перенос `api/course/which-courses-include-module-uc.test.ts` (5) и теста
// `course.module.test.ts` («getCoursesIncludingModule»): порядок результата —
// порядок `courseIds`, неизвестный пропускается, пустой вход — пустой выход без
// чтения. Какие курсы участвуют — `ModuleCoursesDqs` (`module-courses.dqs.test.ts`),
// TST-08. Вызывающий — только `system`.

const C1 = '44444444-4444-4444-8444-444444444441';
const C2 = '44444444-4444-4444-8444-444444444442';
const MISSING = '77777777-7777-4777-8777-777777777777';

let env: ReturnType<typeof makeCourseEnv>;
beforeEach(() => {
  env = makeCourseEnv();
});

const uc = () => new GetCoursesIncludingModuleUc(env.deps, CourseModuleDef);
const including = (courseIds: string[], moduleId = M1) =>
  uc().handle({ moduleId, courseIds }, system, REQ);

describe('GetCoursesIncludingModuleUc', () => {
  it('возвращает uuid курсов, чья программа содержит модуль', async () => {
    env.seedCourses(plainCourse(C1, [M1]), plainCourse(C2, [M2]));

    expect(expectOk(await including([C1, C2]))).toEqual({ courseIds: [C1] });
  });

  it('несуществующий курс пропускается без ошибки', async () => {
    expect(expectOk(await including([MISSING]))).toEqual({ courseIds: [] });
  });

  it('пустой список courseIds — пустой результат без обращения к репозиторию', async () => {
    env.seedCourses(plainCourse(C1, [M1]));

    expect(expectOk(await including([]))).toEqual({ courseIds: [] });
    expect(env.asked.byIds).toEqual([]);
    expect(env.asked.byId).toEqual([]);
    expect(env.asked.filters).toEqual([]);
  });

  it('порядок результата — порядок courseIds (репозиторий отвечает в порядке файла)', async () => {
    env.seedCourses(plainCourse(C1, [M1]), plainCourse(C2, [M1]));

    expect(expectOk(await including([C2, C1]))).toEqual({
      courseIds: [C2, C1],
    });
    expect(expectOk(await including([C1, C2]))).toEqual({
      courseIds: [C1, C2],
    });
  });
});

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
import { GetCoursesStartingWithModuleUc } from './get-courses-starting-with-module.uc';

// Перенос из `course.module.test.ts` (три сценария адаптера
// `getCoursesStartingWithModule`): поведение v0.2.6 — модуль первый в **первом
// опубликованном** курсе файла (`ModuleCoursesDqs.firstPublishedIncluding` +
// `placeOf().isFirst`), и лишь тогда из кандидатов остаются курсы, **включающие**
// модуль, в порядке `courseIds`. Фикстурные случаи С2 — там же, в DQS.

const C1 = '44444444-4444-4444-8444-444444444441';
const C2 = '44444444-4444-4444-8444-444444444442';

let env: ReturnType<typeof makeCourseEnv>;
beforeEach(() => {
  env = makeCourseEnv();
});

const uc = () => new GetCoursesStartingWithModuleUc(env.deps, CourseModuleDef);
const starting = (courseIds: string[], moduleId = M1) =>
  uc().handle({ moduleId, courseIds }, system, REQ);

describe('GetCoursesStartingWithModuleUc — модуль стартовый', () => {
  it('модуль первый в опубликованном курсе — кандидаты, включающие его, как есть', async () => {
    env.seedCourses(plainCourse(C1, [M1, M2]), plainCourse(C2, [M1]));

    expect(expectOk(await starting([C1, C2]))).toEqual({ courseIds: [C1, C2] });
  });

  it('кандидаты без модуля отбрасываются', async () => {
    env.seedCourses(plainCourse(C1, [M1]), plainCourse(C2, [M2]));

    expect(expectOk(await starting([C2, C1]))).toEqual({ courseIds: [C1] });
  });

  it('порядок результата — порядок courseIds', async () => {
    env.seedCourses(plainCourse(C1, [M1]), plainCourse(C2, [M1]));

    expect(expectOk(await starting([C2, C1]))).toEqual({ courseIds: [C2, C1] });
    env.reversed.on = true;
    expect(expectOk(await starting([C1, C2]))).toEqual({ courseIds: [C1, C2] });
  });
});

describe('GetCoursesStartingWithModuleUc — модуль не стартовый', () => {
  it('модуль не первый в опубликованном курсе — пусто, кандидаты не читаются', async () => {
    env.seedCourses(plainCourse(C1, [M1, M2]));

    expect(expectOk(await starting([C1], M2))).toEqual({ courseIds: [] });
    expect(env.asked.byIds).toEqual([]);
    expect(env.asked.byId).toEqual([]);
  });
});

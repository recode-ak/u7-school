import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectOk } from 'dmg-core/testing';
import {
  M1,
  M2,
  makeCourseEnv,
  OUTSIDE,
  plainCourse,
  REQ,
  system,
} from './course-uc.fixture';
import { GetModuleEnrollmentUc } from './get-module-enrollment.uc';

// Перенос из `course.module.test.ts` («у модуля есть место в программе —
// enrollable: true», «места нет — false») на настоящий UC: модуль входит в
// программу хотя бы одного опубликованного курса. Какие курсы участвуют —
// `ModuleCoursesDqs` (`module-courses.dqs.test.ts`), TST-08.
// Вызывающий — только `system`.

const C1 = '44444444-4444-4444-8444-444444444441';

let env: ReturnType<typeof makeCourseEnv>;
beforeEach(() => {
  env = makeCourseEnv();
});

const uc = () => new GetModuleEnrollmentUc(env.deps, CourseModuleDef);
const enrollment = (moduleId: string) => uc().handle({ moduleId }, system, REQ);

describe('GetModuleEnrollmentUc', () => {
  it('место в программе опубликованного курса — enrollable: true', async () => {
    env.seedCourses(plainCourse(C1, [M1, M2]));

    expect(expectOk(await enrollment(M2))).toEqual({ enrollable: true });
  });

  it('модуля нет ни в одном курсе — enrollable: false', async () => {
    env.seedCourses(plainCourse(C1, [M1]));

    expect(expectOk(await enrollment(OUTSIDE))).toEqual({ enrollable: false });
  });
});

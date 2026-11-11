import { beforeEach, describe, expect, it } from 'bun:test';
import {
  CourseModuleDef,
  GetCourseEnrollmentUcDef,
} from '@u7-scl/domain/course/contract';
import { expectOk } from 'dmg-core/testing';
import * as v from 'valibot';
import {
  COURSE,
  courseState,
  M1,
  M2,
  makeCourseEnv,
  REQ,
  system,
} from './course-uc.fixture';
import { GetCourseEnrollmentUc } from './get-course-enrollment.uc';

// Перенос из `course.module.test.ts` («курс доступен и есть стартовый модуль»)
// на настоящий UC над `CourseRepo`. Вызывающий — только `system`.

const MISSING = '99999999-9999-4999-8999-999999999990';

let env: ReturnType<typeof makeCourseEnv>;
beforeEach(() => {
  env = makeCourseEnv();
});

const uc = () => new GetCourseEnrollmentUc(env.deps, CourseModuleDef);
const enrollment = (courseId = COURSE) =>
  uc().handle({ courseId }, system, REQ);

describe('GetCourseEnrollmentUc', () => {
  it('опубликован и есть модули — enrollable со стартовым модулем (moduleIds[0])', async () => {
    env.seedCourses(courseState('published', { moduleIds: [M1, M2] }));

    expect(expectOk(await enrollment())).toEqual({
      enrollable: true,
      startModuleId: M1,
    });
  });

  it('курс не найден — enrollable: false, не ошибка', async () => {
    expect(expectOk(await enrollment(MISSING))).toEqual({ enrollable: false });
  });

  // Схема выхода — межпольная связка варианта: ответ «доступен» без стартового
  // модуля не описывает ни один реальный вызов, его ловит только схема.
  it('схема выхода: enrollable: true без startModuleId — отказ', () => {
    expect(
      v.safeParse(GetCourseEnrollmentUcDef.output, { enrollable: true })
        .success,
    ).toBe(false);
  });
});

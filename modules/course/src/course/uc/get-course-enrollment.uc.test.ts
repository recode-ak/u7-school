import { beforeEach, describe, expect, it } from 'bun:test';
import {
  CourseModuleDef,
  GetCourseEnrollmentUcDef,
} from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import * as v from 'valibot';
import {
  COURSE,
  courseState,
  M1,
  M2,
  makeCourseEnv,
  phase,
  plainCourse,
  REQ,
  student,
  system,
} from './course-uc.fixture';
import { GetCourseEnrollmentUc } from './get-course-enrollment.uc';

// Перенос из `course.module.test.ts` («курс доступен и есть стартовый модуль»,
// «недоступен», «программа пуста») на настоящий UC над `CourseRepo`.
// Курс опубликован и программа не пуста → `startModuleId()`; иначе —
// `enrollable: false` без причины. Вызывающий — только `system`.

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

  it('стартовый — первый модуль программы, а не метка этапа', async () => {
    env.seedCourses(
      plainCourse(COURSE, [M2, M1], 'published', {
        phases: [phase('Основы', M2)],
      }),
    );

    expect(expectOk(await enrollment())).toEqual({
      enrollable: true,
      startModuleId: M2,
    });
  });

  it.each(['draft', 'archived'] as const)(
    'курс в статусе %s — enrollable: false, без причины',
    async (status) => {
      env.seedCourses(courseState(status));

      expect(expectOk(await enrollment())).toEqual({ enrollable: false });
    },
  );

  it('курс опубликован, но программа пуста — enrollable: false', async () => {
    env.seedCourses(courseState('published', { moduleIds: [], phases: [] }));

    expect(expectOk(await enrollment())).toEqual({ enrollable: false });
  });

  it('курс не найден — enrollable: false, не ошибка', async () => {
    expect(expectOk(await enrollment(MISSING))).toEqual({ enrollable: false });
  });

  it('вызывающий user не допущен (callers: system) — UNAUTHORIZED', async () => {
    const res = await uc().handle({ courseId: COURSE }, student as never, REQ);

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'user',
    });
  });

  it('courseId не uuid — INPUT_VALIDATION', async () => {
    expectErr(await enrollment('not-a-uuid'), 'INPUT_VALIDATION');
  });

  it('только читает: ничего не записывается', async () => {
    env.seedCourses(courseState('published'));
    await enrollment();
    expect(env.courses.saved).toEqual([]);
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

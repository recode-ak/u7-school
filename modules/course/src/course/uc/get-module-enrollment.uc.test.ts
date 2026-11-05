import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  A1,
  CCCC,
  FAFA,
  M1,
  M2,
  makeCourseEnv,
  OUTSIDE,
  plainCourse,
  REQ,
  student,
  system,
} from './course-uc.fixture';
import { GetModuleEnrollmentUc } from './get-module-enrollment.uc';

// Перенос из `course.module.test.ts` («у модуля есть место в программе —
// enrollable: true», «места нет — false») на настоящий UC: модуль входит в
// программу хотя бы одного опубликованного курса. Вызывающий — только `system`.

const C1 = '44444444-4444-4444-8444-444444444441';
const C2 = '44444444-4444-4444-8444-444444444442';

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

  it('курсов нет — enrollable: false', async () => {
    expect(expectOk(await enrollment(M1))).toEqual({ enrollable: false });
  });

  it.each(['draft', 'archived'] as const)(
    'модуль только в курсе со статусом %s — enrollable: false',
    async (status) => {
      env.seedCourses(plainCourse(C1, [M1], status));

      expect(expectOk(await enrollment(M1))).toEqual({ enrollable: false });
    },
  );

  it('модуль в архивном и в опубликованном курсе — enrollable: true', async () => {
    env.seedCourses(
      plainCourse(C1, [M1], 'archived'),
      plainCourse(C2, [M1], 'published'),
    );

    expect(expectOk(await enrollment(M1))).toEqual({ enrollable: true });
  });

  it('фикстурный случай С2: a1a1… в двух опубликованных курсах — true', async () => {
    env.seedCourses(
      plainCourse(FAFA, ['a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0', A1]),
      plainCourse(CCCC, [A1]),
    );

    expect(expectOk(await enrollment(A1))).toEqual({ enrollable: true });
  });

  it('вызывающий user не допущен (callers: system) — UNAUTHORIZED', async () => {
    const res = await uc().handle({ moduleId: M1 }, student as never, REQ);

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'user',
    });
  });

  it('moduleId не uuid — INPUT_VALIDATION', async () => {
    expectErr(await enrollment('not-a-uuid'), 'INPUT_VALIDATION');
  });
});

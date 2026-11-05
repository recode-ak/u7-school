import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  A0,
  A1,
  CCCC,
  courseState,
  FAFA,
  M1,
  M2,
  makeCourseEnv,
  OUTSIDE,
  phase,
  plainCourse,
  REQ,
  student,
  system,
} from './course-uc.fixture';
import { GetCoursesStartingWithModuleUc } from './get-courses-starting-with-module.uc';

// Перенос из `course.module.test.ts` (три сценария адаптера
// `getCoursesStartingWithModule`) + фикстурные случаи С2 (расхождение 9 брифа):
// поведение v0.2.6 — модуль первый в **первом опубликованном** курсе файла
// (`ModuleCoursesDqs.firstPublishedIncluding` + `placeOf().isFirst`), и лишь
// тогда из кандидатов остаются курсы, **включающие** модуль (любой статус), в
// порядке `courseIds`. Замена правила — правка одного DQS (`DEBT` с С2).

const C1 = '44444444-4444-4444-8444-444444444441';
const C2 = '44444444-4444-4444-8444-444444444442';
const ARCHIVED = '66666666-6666-4666-8666-666666666666';
const MISSING = '77777777-7777-4777-8777-777777777777';

let env: ReturnType<typeof makeCourseEnv>;
beforeEach(() => {
  env = makeCourseEnv();
});

const uc = () => new GetCoursesStartingWithModuleUc(env.deps, CourseModuleDef);
const starting = (courseIds: string[], moduleId = M1) =>
  uc().handle({ moduleId, courseIds }, system, REQ);

/** Фикстурный курс fafa…: a0a0… и a1a1…, два этапа по одному модулю. */
const fafa = () =>
  courseState('published', {
    uuid: FAFA,
    moduleIds: [A0, A1],
    phases: [phase('Синтаксис', A0), phase('Алгоритмика', A1)],
  });

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

  it('архивный кандидат с модулем учитывается; неизвестный пропускается', async () => {
    env.seedCourses(
      plainCourse(C1, [M1]),
      plainCourse(ARCHIVED, [M1], 'archived'),
    );

    expect(expectOk(await starting([ARCHIVED, MISSING, C1]))).toEqual({
      courseIds: [ARCHIVED, C1],
    });
  });

  it('пустой список кандидатов — пусто', async () => {
    env.seedCourses(plainCourse(C1, [M1]));

    expect(expectOk(await starting([]))).toEqual({ courseIds: [] });
  });
});

describe('GetCoursesStartingWithModuleUc — модуль не стартовый', () => {
  it('модуль не первый в опубликованном курсе — пусто, кандидаты не читаются', async () => {
    env.seedCourses(plainCourse(C1, [M1, M2]));

    expect(expectOk(await starting([C1], M2))).toEqual({ courseIds: [] });
    expect(env.asked.byIds).toEqual([]);
    expect(env.asked.byId).toEqual([]);
  });

  it('модуль вне опубликованных программ — пусто', async () => {
    env.seedCourses(
      plainCourse(C1, [M1], 'archived'),
      plainCourse(C2, [M2], 'draft'),
    );

    expect(expectOk(await starting([C1, C2]))).toEqual({ courseIds: [] });
    expect(expectOk(await starting([C1], OUTSIDE))).toEqual({ courseIds: [] });
  });

  it('архивный курс первым в файле не участвует в выборе места', async () => {
    env.seedCourses(
      plainCourse(ARCHIVED, [M2, M1], 'archived'),
      plainCourse(C1, [M1]),
    );

    expect(expectOk(await starting([C1, ARCHIVED]))).toEqual({
      courseIds: [C1, ARCHIVED],
    });
  });
});

describe('GetCoursesStartingWithModuleUc — фикстурные случаи С2 (a1a1…)', () => {
  it('fafa… перед cccc…: место берётся по fafa… (a1a1… не первый) — пусто, хотя в cccc… он стартовый', async () => {
    env.seedCourses(fafa(), plainCourse(CCCC, [A1]));

    expect(expectOk(await starting([CCCC], A1))).toEqual({ courseIds: [] });
    expect(expectOk(await starting([FAFA, CCCC], A1))).toEqual({
      courseIds: [],
    });
  });

  it('cccc… перед fafa…: a1a1… первый — кандидаты, включающие модуль (в т. ч. fafa…, где он не стартовый)', async () => {
    env.seedCourses(plainCourse(CCCC, [A1]), fafa());

    expect(expectOk(await starting([FAFA, CCCC], A1))).toEqual({
      courseIds: [FAFA, CCCC],
    });
  });

  it('a0a0… первый в fafa… — fafa… из кандидатов возвращается', async () => {
    env.seedCourses(fafa(), plainCourse(CCCC, [A1]));

    expect(expectOk(await starting([FAFA, CCCC], A0))).toEqual({
      courseIds: [FAFA],
    });
  });
});

describe('GetCoursesStartingWithModuleUc — вход и вызывающий', () => {
  it('вызывающий user не допущен (callers: system) — UNAUTHORIZED', async () => {
    const res = await uc().handle(
      { moduleId: M1, courseIds: [] },
      student as never,
      REQ,
    );

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'user',
    });
  });

  it('courseIds с не-uuid — INPUT_VALIDATION', async () => {
    expectErr(await starting(['not-a-uuid']), 'INPUT_VALIDATION');
  });

  it('только читает: ничего не записывается', async () => {
    env.seedCourses(plainCourse(C1, [M1]));
    await starting([C1]);
    expect(env.courses.saved).toEqual([]);
  });
});

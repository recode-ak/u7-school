import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  anonymous,
  COURSE,
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
import { GetModulePlaceUc } from './get-module-place.uc';

// Перенос `api/course/get-module-place-uc.test.ts` (7): место модуля в
// программе, этапы, только опубликованные курсы, модуль вне курсов — пусто.
// Форма места (первый/средний/последний, линейный порядок, `stage`) —
// `CourseAr.placeOf` (`course.ar.test.ts`), правило «курс модуля» —
// `ModuleCoursesDqs` (`module-courses.dqs.test.ts`) — TST-08.

const C1 = '44444444-4444-4444-8444-444444444441';
const C2 = '44444444-4444-4444-8444-444444444442';

let env: ReturnType<typeof makeCourseEnv>;
beforeEach(() => {
  env = makeCourseEnv();
});

const uc = () => new GetModulePlaceUc(env.deps, CourseModuleDef);
const place = (
  moduleId: string,
  caller: Parameters<GetModulePlaceUc['handle']>[1] = student,
) => uc().handle({ moduleId }, caller, REQ);

describe('GetModulePlaceUc — место в программе (курс без этапов)', () => {
  beforeEach(() => {
    env.seedCourses(plainCourse(COURSE, [M1, M2, M3]));
  });

  it('stage у курса без этапов нет', async () => {
    expect(expectOk(await place(M2))).not.toHaveProperty('stage');
  });

  it('модуль вне курсов — пусто, не ошибка', async () => {
    expect(expectOk(await place(OUTSIDE))).toBeUndefined();
  });
});

describe('GetModulePlaceUc — этапы', () => {
  it('курс из одного этапа: прежний результат плюс stage', async () => {
    env.seedCourses(
      courseState('published', {
        moduleIds: [M1, M2, M3],
        phases: [phase('Основы JS', M1, 'tech')],
      }),
    );

    expect(expectOk(await place(M2))).toEqual({
      courseId: COURSE,
      isFirst: false,
      isLast: false,
      prevModuleId: M1,
      nextModuleId: M3,
      stage: { index: 0, title: 'Основы JS', track: 'tech' },
    });
  });

  it('несколько этапов — линейный порядок через границу этапов (flatMap)', async () => {
    env.seedCourses(
      courseState('published', {
        moduleIds: [M1, M2, M3],
        phases: [phase('P1', M1), phase('P2', M2)],
      }),
    );

    expect(expectOk(await place(M2))).toEqual({
      courseId: COURSE,
      isFirst: false,
      isLast: false,
      prevModuleId: M1,
      nextModuleId: M3,
      stage: { index: 1, title: 'P2' },
    });
  });
});

describe('GetModulePlaceUc — какие курсы участвуют', () => {
  it('запрашивает только опубликованные курсы', async () => {
    env.seedCourses(plainCourse(COURSE, [M1]));

    await place(M1);

    expect(env.asked.filters).toEqual([{ status: 'published' }]);
  });

  it.each(['archived', 'draft'] as const)(
    'курс в статусе %s не участвует: берётся следующий опубликованный',
    async (status) => {
      env.seedCourses(plainCourse(C1, [M1], status), plainCourse(C2, [M1]));

      expect(expectOk(await place(M1))?.courseId).toBe(C2);
    },
  );

  it('только неопубликованный курс — пусто', async () => {
    env.seedCourses(plainCourse(C1, [M1], 'archived'));

    expect(expectOk(await place(M1))).toBeUndefined();
  });
});

describe('GetModulePlaceUc — вход и вызывающий', () => {
  it('гость допущен (реакция на событие, без актора)', async () => {
    env.seedCourses(plainCourse(COURSE, [M1]));

    expect(expectOk(await place(M1, anonymous))?.courseId).toBe(COURSE);
  });

  it('moduleId не uuid — INPUT_VALIDATION', async () => {
    expectErr(await place('not-a-uuid'), 'INPUT_VALIDATION');
  });

  it('вызывающий system не допущен (callers: user, guest) — UNAUTHORIZED', async () => {
    const res = await uc().handle({ moduleId: M1 }, system as never, REQ);

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'system',
    });
  });

  it('только читает: ничего не записывается', async () => {
    env.seedCourses(plainCourse(COURSE, [M1]));
    await place(M1);
    expect(env.courses.saved).toEqual([]);
  });
});

import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseAr } from '@u7-scl/domain/course';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  anonymous,
  author,
  COURSE,
  courseState,
  M1,
  M2,
  M3,
  M4,
  makeCourseEnv,
  phase,
  REQ,
  student,
  system,
} from './course-uc.fixture';
import { GetCourseUc } from './get-course.uc';

// Перенос `api/course/get-course-uc.test.ts` (3): курс по id — виден любого
// статуса и любому вызывающему (вариант А С1, без Policy); не найден —
// `COURSE_NOT_FOUND` вместо `CourseNotFoundUcError`. Новое: вход `{ courseId }`
// (Т5), выход со `stages`.

const MISSING = '99999999-9999-4999-8999-999999999990';

let env: ReturnType<typeof makeCourseEnv>;
beforeEach(() => {
  env = makeCourseEnv();
});

const uc = () => new GetCourseUc(env.deps, CourseModuleDef);
const get = (
  caller: Parameters<GetCourseUc['handle']>[1] = student,
  courseId = COURSE,
) => uc().handle({ courseId }, caller, REQ);

describe('GetCourseUc — успех', () => {
  it('возвращает курс по id: представление CourseView', async () => {
    env.seedCourses(courseState('published'));

    expect(expectOk(await get())).toEqual(
      CourseAr.restore(courseState('published')).view(),
    );
  });

  it('опубликованный курс виден гостю без авторизации', async () => {
    env.seedCourses(courseState('published'));

    expect(expectOk(await get(anonymous)).uuid).toBe(COURSE);
  });

  it.each(['draft', 'archived'] as const)(
    'курс в статусе %s виден гостю, студенту и автору (вариант А С1)',
    async (status) => {
      env.seedCourses(courseState(status));

      for (const caller of [anonymous, student, author]) {
        expect(expectOk(await get(caller)).status).toBe(status);
      }
    },
  );

  it('в представлении этапы stages, а не метки phases', async () => {
    env.seedCourses(
      courseState('published', {
        phases: [phase('Синтаксис', M1, 'tech'), phase('Алгоритмика', M3)],
      }),
    );

    const view = expectOk(await get());

    expect(view.stages).toEqual([
      { title: 'Синтаксис', track: 'tech', moduleIds: [M1, M2] },
      { title: 'Алгоритмика', moduleIds: [M3, M4] },
    ]);
    expect(view).not.toHaveProperty('phases');
  });

  it('курс без этапов: stages = []', async () => {
    env.seedCourses(courseState('published', { phases: [] }));

    expect(expectOk(await get()).stages).toEqual([]);
  });

  it('только читает: ничего не записывается', async () => {
    env.seedCourses(courseState('published'));
    await get();
    expect(env.courses.saved).toEqual([]);
  });
});

describe('GetCourseUc — отказы', () => {
  it('курса нет — COURSE_NOT_FOUND { courseId }, kind not_found', async () => {
    const error = expectErr(await get(student, MISSING), 'COURSE_NOT_FOUND');

    expect(error.kind).toBe('not_found');
    expect(error.label).toBe('Курс не найден');
    expect(error.payload).toEqual({ courseId: MISSING });
  });

  it('вход не uuid — INPUT_VALIDATION', async () => {
    expectErr(await get(student, 'not-a-uuid'), 'INPUT_VALIDATION');
  });

  it('вызывающий system не допущен (callers: user, guest) — UNAUTHORIZED', async () => {
    env.seedCourses(courseState('published'));

    const res = await uc().handle({ courseId: COURSE }, system as never, REQ);

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'system',
    });
  });

  it('сбой репозитория — SERVER_INTERNAL, а не COURSE_NOT_FOUND', async () => {
    env.courses.findById = async () => {
      throw new Error('диск недоступен');
    };

    expectErr(await get(), 'SERVER_INTERNAL');
  });
});

import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseAr } from '@u7-scl/domain/course';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  COURSE,
  courseState,
  makeCourseEnv,
  REQ,
  student,
} from './course-uc.fixture';
import { GetCourseUc } from './get-course.uc';

// Перенос `api/course/get-course-uc.test.ts` (3): курс по id виден любого
// статуса и любому вызывающему (вариант А С1, без Policy); не найден —
// `COURSE_NOT_FOUND` вместо `CourseNotFoundUcError`. Представление курса
// (этапы, статусы) — `CourseAr.view` (`course.ar.test.ts`), TST-08.

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
});

describe('GetCourseUc — отказы', () => {
  it('курса нет — COURSE_NOT_FOUND { courseId }, kind not_found', async () => {
    const error = expectErr(await get(student, MISSING), 'COURSE_NOT_FOUND');

    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ courseId: MISSING });
  });

  it('сбой репозитория — SERVER_INTERNAL, а не COURSE_NOT_FOUND', async () => {
    env.courses.findById = async () => {
      throw new Error('диск недоступен');
    };

    expectErr(await get(), 'SERVER_INTERNAL');
  });
});

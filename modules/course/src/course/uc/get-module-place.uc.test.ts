import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectOk } from 'dmg-core/testing';
import {
  COURSE,
  courseState,
  M1,
  M2,
  M3,
  makeCourseEnv,
  phase,
  plainCourse,
  REQ,
  student,
} from './course-uc.fixture';
import { GetModulePlaceUc } from './get-module-place.uc';

// Перенос `api/course/get-module-place-uc.test.ts` (7): место модуля в
// программе, этапы, только опубликованные курсы. Форма места (первый/средний/
// последний, линейный порядок, `stage`) — `CourseAr.placeOf`
// (`course.ar.test.ts`), правило «курс модуля» — `ModuleCoursesDqs`
// (`module-courses.dqs.test.ts`), TST-08.

let env: ReturnType<typeof makeCourseEnv>;
beforeEach(() => {
  env = makeCourseEnv();
});

const uc = () => new GetModulePlaceUc(env.deps, CourseModuleDef);
const place = (moduleId: string) => uc().handle({ moduleId }, student, REQ);

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
});

describe('GetModulePlaceUc — какие курсы участвуют', () => {
  it('запрашивает только опубликованные курсы', async () => {
    env.seedCourses(plainCourse(COURSE, [M1]));

    await place(M1);

    expect(env.asked.filters).toEqual([{ status: 'published' }]);
  });
});

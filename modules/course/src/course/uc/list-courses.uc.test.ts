import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectOk } from 'dmg-core/testing';
import {
  AUTHOR,
  M1,
  M2,
  makeCourseEnv,
  plainCourse,
  REQ,
  student,
} from './course-uc.fixture';
import { ListCoursesUc } from './list-courses.uc';

// Перенос `api/course/list-courses-uc.test.ts` (3): по умолчанию только
// `published` (`list-courses-uc.ts:34`), фильтры и сортировку делает репозиторий,
// пустой список — `[]`. Вызывающий: user и guest. Выход — `CourseView`
// (`CourseAr.view`, `course.ar.test.ts`).

const C1 = '44444444-4444-4444-8444-444444444441';
const C2 = '44444444-4444-4444-8444-444444444442';
const C3 = '44444444-4444-4444-8444-444444444443';

let env: ReturnType<typeof makeCourseEnv>;
beforeEach(() => {
  env = makeCourseEnv();
});

const uc = () => new ListCoursesUc(env.deps, CourseModuleDef);
const list = (
  input: Parameters<ListCoursesUc['handle']>[0],
  caller: Parameters<ListCoursesUc['handle']>[1] = student,
) => uc().handle(input, caller, REQ);

describe('ListCoursesUc — успех', () => {
  it('возвращает список курсов в порядке репозитория', async () => {
    env.seedCourses(plainCourse(C1, [M1]), plainCourse(C2, [M2]));

    expect(expectOk(await list({})).map((c) => c.uuid)).toEqual([C1, C2]);
  });

  it('статус по умолчанию — published: черновики и архив не попадают', async () => {
    env.seedCourses(
      plainCourse(C1, [M1], 'draft'),
      plainCourse(C2, [M1], 'published'),
      plainCourse(C3, [M1], 'archived'),
    );

    expect(expectOk(await list({})).map((c) => c.uuid)).toEqual([C2]);
    expect(env.asked.filters).toHaveLength(1);
    expect(env.asked.filters[0]).toMatchObject({ status: 'published' });
  });

  it.each<
    [string, Parameters<ListCoursesUc['handle']>[0], Record<string, unknown>]
  >([
    ['явный статус', { status: 'draft' }, { status: 'draft' }],
    [
      'authorId, title, sort и limit',
      { authorId: AUTHOR, title: 'js', sort: 'createdAt:desc', limit: 2 },
      {
        status: 'published',
        authorId: AUTHOR,
        title: 'js',
        sort: 'createdAt:desc',
        limit: 2,
      },
    ],
  ])('%s передаются репозиторию как есть', async (_, input, expected) => {
    await list(input);

    expect(env.asked.filters[0]).toMatchObject(expected);
  });
});

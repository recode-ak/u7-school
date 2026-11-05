import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  AUTHOR,
  anonymous,
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
import { ListCoursesUc } from './list-courses.uc';

// Перенос `api/course/list-courses-uc.test.ts` (3): по умолчанию только
// `published` (`list-courses-uc.ts:34`), фильтры и сортировку делает репозиторий,
// пустой список — `[]`. Вызывающий: user и guest. Выход — `CourseView`.

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

  it('пустой список, если курсов нет', async () => {
    expect(expectOk(await list({}))).toEqual([]);
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

  it('явный статус передаётся репозиторию (черновики может запросить любой, как в v0.2.6)', async () => {
    env.seedCourses(
      plainCourse(C1, [M1], 'draft'),
      plainCourse(C2, [M1], 'published'),
    );

    expect(
      expectOk(await list({ status: 'draft' }, anonymous)).map((c) => c.uuid),
    ).toEqual([C1]);
    expect(env.asked.filters[0]).toMatchObject({ status: 'draft' });
  });

  it('authorId, title, sort и limit передаются репозиторию как есть', async () => {
    await list({
      authorId: AUTHOR,
      title: 'js',
      sort: 'createdAt:desc',
      limit: 2,
    });

    expect(env.asked.filters[0]).toMatchObject({
      status: 'published',
      authorId: AUTHOR,
      title: 'js',
      sort: 'createdAt:desc',
      limit: 2,
    });
  });

  it('выход содержит stages (навигация строится по ним)', async () => {
    env.seedCourses(
      courseState('published', {
        uuid: C1,
        moduleIds: [M1, M2],
        phases: [phase('Синтаксис', M1), phase('Алгоритмика', M2)],
      }),
      plainCourse(C2, [M1]),
    );

    const [first, second] = expectOk(await list({}));

    expect(first?.stages).toEqual([
      { title: 'Синтаксис', moduleIds: [M1] },
      { title: 'Алгоритмика', moduleIds: [M2] },
    ]);
    expect(second?.stages).toEqual([]);
  });

  it('гость и пользователь получают один и тот же список', async () => {
    env.seedCourses(plainCourse(C1, [M1]));

    expect(expectOk(await list({}, anonymous))).toEqual(
      expectOk(await list({}, student)),
    );
  });

  it('только читает: ничего не записывается', async () => {
    env.seedCourses(plainCourse(C1, [M1]));
    await list({});
    expect(env.courses.saved).toEqual([]);
  });
});

describe('ListCoursesUc — вход и вызывающий', () => {
  it.each([
    ['limit 0', { limit: 0 }],
    ['статус вне перечня', { status: 'open' }],
    ['authorId не uuid', { authorId: 'x' }],
  ])('%s — INPUT_VALIDATION', async (_, input) => {
    expectErr(await list(input as never), 'INPUT_VALIDATION');
  });

  it('вызывающий system не допущен (callers: user, guest) — UNAUTHORIZED', async () => {
    const res = await uc().handle({}, system as never, REQ);

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'system',
    });
  });

  it('сбой репозитория — SERVER_INTERNAL', async () => {
    env.courses.findAll = async () => {
      throw new Error('диск недоступен');
    };

    expectErr(await list({}), 'SERVER_INTERNAL');
  });
});

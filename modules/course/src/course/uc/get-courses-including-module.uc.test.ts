import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  M1,
  M2,
  makeCourseEnv,
  plainCourse,
  REQ,
  student,
  system,
} from './course-uc.fixture';
import { GetCoursesIncludingModuleUc } from './get-courses-including-module.uc';

// Перенос `api/course/which-courses-include-module-uc.test.ts` (5) и теста
// `course.module.test.ts` («getCoursesIncludingModule»): порядок результата —
// порядок `courseIds`, архивный курс учитывается, неизвестный пропускается,
// пустой вход — пустой выход без чтения. Вызывающий — только `system`.

const C1 = '44444444-4444-4444-8444-444444444441';
const C2 = '44444444-4444-4444-8444-444444444442';
const ARCHIVED = '66666666-6666-4666-8666-666666666666';
const MISSING = '77777777-7777-4777-8777-777777777777';

let env: ReturnType<typeof makeCourseEnv>;
beforeEach(() => {
  env = makeCourseEnv();
});

const uc = () => new GetCoursesIncludingModuleUc(env.deps, CourseModuleDef);
const including = (courseIds: string[], moduleId = M1) =>
  uc().handle({ moduleId, courseIds }, system, REQ);

describe('GetCoursesIncludingModuleUc', () => {
  it('возвращает uuid курсов, чья программа содержит модуль', async () => {
    env.seedCourses(plainCourse(C1, [M1]), plainCourse(C2, [M2]));

    expect(expectOk(await including([C1, C2]))).toEqual({ courseIds: [C1] });
  });

  it('архивный курс тоже учитывается (историческая принадлежность)', async () => {
    env.seedCourses(plainCourse(ARCHIVED, [M1], 'archived'));

    expect(expectOk(await including([ARCHIVED]))).toEqual({
      courseIds: [ARCHIVED],
    });
  });

  it('черновой курс учитывается', async () => {
    env.seedCourses(plainCourse(C1, [M1], 'draft'));

    expect(expectOk(await including([C1]))).toEqual({ courseIds: [C1] });
  });

  it('несуществующий курс пропускается без ошибки', async () => {
    expect(expectOk(await including([MISSING]))).toEqual({ courseIds: [] });
  });

  it('пустой список courseIds — пустой результат без обращения к репозиторию', async () => {
    env.seedCourses(plainCourse(C1, [M1]));

    expect(expectOk(await including([]))).toEqual({ courseIds: [] });
    expect(env.asked.byIds).toEqual([]);
    expect(env.asked.byId).toEqual([]);
    expect(env.asked.filters).toEqual([]);
  });

  it('порядок результата — порядок courseIds (репозиторий отвечает в порядке файла)', async () => {
    env.seedCourses(plainCourse(C1, [M1]), plainCourse(C2, [M1]));

    expect(expectOk(await including([C2, C1]))).toEqual({
      courseIds: [C2, C1],
    });
    expect(expectOk(await including([C1, C2]))).toEqual({
      courseIds: [C1, C2],
    });
  });

  it('порядок courseIds сохраняется и при обратном порядке ответа репозитория', async () => {
    env.seedCourses(plainCourse(C1, [M1]), plainCourse(C2, [M1]));
    env.reversed.on = true;

    expect(expectOk(await including([C1, C2]))).toEqual({
      courseIds: [C1, C2],
    });
  });

  it('курсы без модуля отбрасываются, остальные остаются в порядке courseIds', async () => {
    env.seedCourses(
      plainCourse(C1, [M2]),
      plainCourse(C2, [M1]),
      plainCourse(ARCHIVED, [M1], 'archived'),
    );

    expect(expectOk(await including([ARCHIVED, C1, C2]))).toEqual({
      courseIds: [ARCHIVED, C2],
    });
  });

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
    expectErr(await including(['not-a-uuid']), 'INPUT_VALIDATION');
  });

  it('только читает: ничего не записывается', async () => {
    env.seedCourses(plainCourse(C1, [M1]));
    await including([C1]);
    expect(env.courses.saved).toEqual([]);
  });
});

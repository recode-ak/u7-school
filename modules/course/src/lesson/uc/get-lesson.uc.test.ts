import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  anonymous,
  author,
  LESSON_1,
  lessonState,
  MODULE,
  makeContentEnv,
  moduleState,
  OTHER_MODULE,
  otherMentor,
  REQ,
  student,
} from '../../content-uc.fixture';
import { GetLessonUc } from './get-lesson.uc';

// Перенос `api/lesson/get-lesson-uc.test.ts` (4) на Def UC. Видимость урока
// считает `ModulePolicy.canSeeUnpublished` с модулем-владельцем: автор и
// администратор видят любой статус, остальные — только `published`. Отказ —
// базовый ACCESS_DENIED (не LESSON_ACCESS_DENIED). Правила видимости —
// `domain/src/module/module.policy.test.ts`, представление урока —
// `lesson.ar.test.ts` (TST-08).

let env: ReturnType<typeof makeContentEnv>;
beforeEach(() => {
  env = makeContentEnv();
  env.modules.seed(moduleState('published'));
});

const uc = () => new GetLessonUc(env.deps, CourseModuleDef);
const get = (caller: Parameters<GetLessonUc['handle']>[1], id = LESSON_1) =>
  uc().handle({ lessonId: id }, caller, REQ);

describe('GetLessonUc — успех', () => {
  it('опубликованный урок виден гостю («PUBLISHED без актора»)', async () => {
    env.lessons.seed(lessonState(LESSON_1, 'published', { title: 'Урок' }));

    const view = expectOk(await get(anonymous));

    expect(view.title).toBe('Урок');
    expect(view.uuid).toBe(LESSON_1);
    expect(view.moduleId).toBe(MODULE);
  });

  it('автор модуля видит DRAFT урок (без роли AUTHOR)', async () => {
    env.lessons.seed(lessonState(LESSON_1, 'draft', { title: 'Урок' }));
    expect(expectOk(await get(author)).title).toBe('Урок');
  });

  it('ментор (роль), не автор, видит DRAFT урок (Ф4а)', async () => {
    env.lessons.seed(lessonState(LESSON_1, 'draft', { title: 'Урок' }));
    expect(expectOk(await get(otherMentor)).title).toBe('Урок');
  });

  it('студент не видит DRAFT урок — ACCESS_DENIED, опубликованный виден (Ф4а)', async () => {
    env.lessons.seed(lessonState(LESSON_1, 'draft'));
    expectErr(await get(student), 'ACCESS_DENIED');
  });

  it('модуль спрашивается по moduleId урока', async () => {
    env.lessons.seed(lessonState(LESSON_1, 'published'));
    await get(student);
    expect(env.asked.modules).toEqual([MODULE]);
  });
});

describe('GetLessonUc — отказы', () => {
  it('урока нет — LESSON_NOT_FOUND «Урок не найден», kind not_found', async () => {
    const error = expectErr(await get(student), 'LESSON_NOT_FOUND');

    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ lessonId: LESSON_1 });
  });

  it('модуля-владельца нет — MODULE_NOT_FOUND', async () => {
    env.lessons.seed(
      lessonState(LESSON_1, 'published', { moduleId: OTHER_MODULE }),
    );

    const error = expectErr(await get(student), 'MODULE_NOT_FOUND');

    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ moduleId: OTHER_MODULE });
  });

  it('гость на черновом модуле — ACCESS_DENIED (canSeeUnpublished)', async () => {
    env.lessons.seed(lessonState(LESSON_1, 'draft'));

    const error = expectErr(await get(anonymous), 'ACCESS_DENIED');

    expect(error.kind).toBe('access');
    expect(error.payload).toMatchObject({ rule: 'canSeeUnpublished' });
  });
});

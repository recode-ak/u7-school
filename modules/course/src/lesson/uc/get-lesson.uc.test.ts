import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  admin,
  anonymous,
  author,
  LESSON_1,
  lessonState,
  MODULE,
  makeContentEnv,
  moduleState,
  OTHER_ID,
  OTHER_MODULE,
  otherMentor,
  REQ,
  STEP_1,
  STEP_2,
  student,
  system,
} from '../../content-uc.fixture';
import { GetLessonUc } from './get-lesson.uc';

// Перенос `api/lesson/get-lesson-uc.test.ts` (4) на Def UC. Видимость урока
// считает `ModulePolicy.canSeeUnpublished` с модулем-владельцем: автор и
// администратор видят любой статус, остальные — только `published`. Отказ —
// базовый ACCESS_DENIED (не LESSON_ACCESS_DENIED).

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

  it('опубликованный урок виден студенту', async () => {
    env.lessons.seed(lessonState(LESSON_1, 'published'));
    expect(expectOk(await get(student)).status).toBe('published');
  });

  it('автор модуля видит DRAFT урок (без роли AUTHOR)', async () => {
    env.lessons.seed(lessonState(LESSON_1, 'draft', { title: 'Урок' }));
    expect(expectOk(await get(author)).title).toBe('Урок');
  });

  it('администратор видит чужой DRAFT урок', async () => {
    env.lessons.seed(lessonState(LESSON_1, 'draft'));
    expect(expectOk(await get(admin)).status).toBe('draft');
  });

  it('автор видит archived урок', async () => {
    env.lessons.seed(lessonState(LESSON_1, 'archived'));
    expect(expectOk(await get(author)).status).toBe('archived');
  });

  it('опубликованный урок виден гостю, даже если модуль в черновике (видимость урока не зависит от статуса модуля)', async () => {
    env.modules.seed(moduleState('draft'));
    env.lessons.seed(lessonState(LESSON_1, 'published'));

    expect(expectOk(await get(anonymous)).uuid).toBe(LESSON_1);
  });

  it('представление: шаги, время, даты числами, version', async () => {
    env.lessons.seed(
      lessonState(LESSON_1, 'published', {
        additional: 'Доп',
        estimatedMinutes: 30,
        stepIds: [STEP_1, STEP_2],
        mentorStepIds: [STEP_2],
      }),
    );

    const view = expectOk(await get(student));

    expect(view).toMatchObject({
      additional: 'Доп',
      estimatedMinutes: 30,
      stepIds: [STEP_1, STEP_2],
      mentorStepIds: [STEP_2],
      version: 0,
    });
    expect(typeof view.createdAt).toBe('number');
  });

  it('урок только читается: ничего не записывается', async () => {
    env.lessons.seed(lessonState(LESSON_1, 'published'));
    await get(student);
    expect(env.lessons.saved).toEqual([]);
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
    expect(error.label).toBe('Урок не найден');
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

  it.each([
    ['гость, draft', anonymous, 'draft'],
    ['студент, draft', student, 'draft'],
    ['чужой ментор, draft', otherMentor, 'draft'],
    ['гость, archived', anonymous, 'archived'],
    ['студент, archived', student, 'archived'],
  ] as const)(
    '%s — ACCESS_DENIED «Нет доступа к модулю»',
    async (_, caller, status) => {
      env.lessons.seed(lessonState(LESSON_1, status));

      const error = expectErr(await get(caller), 'ACCESS_DENIED');

      expect(error.kind).toBe('access');
      expect(error.payload).toMatchObject({
        rule: 'canSeeUnpublished',
        denyMessage: 'Нет доступа к модулю',
      });
    },
  );

  it('автор другого модуля не видит DRAFT урок этого модуля (право — по модулю-владельцу урока)', async () => {
    env.modules.seed(
      moduleState('published', { uuid: OTHER_MODULE, authorId: OTHER_ID }),
    );
    env.lessons.seed(lessonState(LESSON_1, 'draft'));

    expectErr(await get(otherMentor), 'ACCESS_DENIED');
  });

  it('автор модуля урока видит DRAFT, даже если модуль в черновике', async () => {
    env.modules.seed(moduleState('draft'));
    env.lessons.seed(lessonState(LESSON_1, 'draft'));

    expect(expectOk(await get(author)).status).toBe('draft');
  });

  it('вызывающий system не допущен (callers: user, guest) — UNAUTHORIZED', async () => {
    env.lessons.seed(lessonState(LESSON_1, 'published'));

    const res = await uc().handle({ lessonId: LESSON_1 }, system as never, REQ);

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'system',
    });
  });

  it('неверный uuid во входе — INPUT_VALIDATION', async () => {
    expectErr(await get(student, 'not-a-uuid'), 'INPUT_VALIDATION');
  });

  it('прежнее имя поля uuid во входе — INPUT_VALIDATION (Т8)', async () => {
    const res = await uc().handle({ uuid: LESSON_1 } as never, student, REQ);
    expectErr(res, 'INPUT_VALIDATION');
  });
});

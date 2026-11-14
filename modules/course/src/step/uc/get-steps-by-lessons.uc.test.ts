import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectOk } from 'dmg-core/testing';
import {
  LESSON_1,
  LESSON_2,
  LESSON_3,
  lessonState,
  MODULE,
  makeContentEnv,
  moduleState,
  OTHER_ID,
  OTHER_MODULE,
  otherMentor,
  plainAuthor,
  REQ,
  STEP_1,
  STEP_2,
  STEP_3,
  student,
  textStep,
} from '../../content-uc.fixture';
import { GetStepsByLessonsUc } from './get-steps-by-lessons.uc';

// Ответственность UC: уроки и шаги читаются одним запросом каждый, модуль
// спрашивается один раз на различный `moduleId` (Т6). Правила сборки ответа —
// на уровне `LessonStepsDqs` (TST-08).

let env: ReturnType<typeof makeContentEnv>;
beforeEach(() => {
  env = makeContentEnv();
  env.modules.seed(moduleState('published'));
});

const uc = () => new GetStepsByLessonsUc(env.deps, CourseModuleDef);
const get = (
  lessonIds: string[],
  caller: Parameters<GetStepsByLessonsUc['handle']>[1] = student,
) => uc().handle({ lessonIds }, caller, REQ);

/** Урок `id` из шагов `stepIds`, шаги опубликованы (описание — по номеру). */
function seedLesson(id: string, stepIds: string[]) {
  env.lessons.seed(lessonState(id, 'published', { stepIds }));
  for (const stepId of stepIds) env.steps.seed(textStep(stepId, 'published'));
}

describe('GetStepsByLessonsUc — успех', () => {
  it('шаги урока: uuid, description и status — и только они', async () => {
    seedLesson(LESSON_1, [STEP_1]);

    const result = expectOk(await get([LESSON_1]));

    expect(result).toEqual({
      [LESSON_1]: [{ uuid: STEP_1, description: 'Шаг 1', status: 'published' }],
    });
    expect(Object.keys(result[LESSON_1]?.[0] ?? {}).sort()).toEqual([
      'description',
      'status',
      'uuid',
    ]);
  });

  it('ментор (роль), не автор, получает draft и archived шаги со статусом (Ф4а)', async () => {
    env.lessons.seed(
      lessonState(LESSON_1, 'published', { stepIds: [STEP_1, STEP_2, STEP_3] }),
    );
    env.steps.seed(
      textStep(STEP_1, 'published'),
      textStep(STEP_2, 'draft'),
      textStep(STEP_3, 'archived'),
    );

    const result = expectOk(await get([LESSON_1], otherMentor));

    expect(result[LESSON_1]?.map((s) => [s.uuid, s.status])).toEqual([
      [STEP_1, 'published'],
      [STEP_2, 'draft'],
      [STEP_3, 'archived'],
    ]);
  });

  it('студент: draft и archived шаги пропускаются, published остаётся (Ф4а)', async () => {
    env.lessons.seed(
      lessonState(LESSON_1, 'published', { stepIds: [STEP_1, STEP_2, STEP_3] }),
    );
    env.steps.seed(
      textStep(STEP_1, 'published'),
      textStep(STEP_2, 'draft'),
      textStep(STEP_3, 'archived'),
    );

    const result = expectOk(await get([LESSON_1], student));

    expect(result[LESSON_1]?.map((s) => s.uuid)).toEqual([STEP_1]);
  });
});

describe('GetStepsByLessonsUc — модули шагов', () => {
  beforeEach(() => {
    env.modules.seed(
      moduleState('published', { uuid: OTHER_MODULE, authorId: OTHER_ID }),
    );
  });

  it('право считается по модулю каждого шага: автор видит свои черновики и не видит чужие', async () => {
    env.lessons.seed(
      lessonState(LESSON_1, 'published', { stepIds: [STEP_1, STEP_2] }),
    );
    env.steps.seed(
      textStep(STEP_1, 'draft', { moduleId: MODULE }),
      textStep(STEP_2, 'draft', { moduleId: OTHER_MODULE }),
    );

    const result = expectOk(await get([LESSON_1], plainAuthor));

    expect(result[LESSON_1]?.map((s) => s.uuid)).toEqual([STEP_1]);
  });

  it('модуль шага не найден — шаг пропускается (v0.2.6, Т5), вызов не падает', async () => {
    const missing = '4a3b2c1d-0e9f-4a8b-9c7d-000000000000';
    env.lessons.seed(
      lessonState(LESSON_1, 'published', { stepIds: [STEP_1, STEP_2] }),
    );
    env.steps.seed(
      textStep(STEP_1, 'published', { moduleId: missing }),
      textStep(STEP_2, 'published'),
    );

    const result = expectOk(await get([LESSON_1]));

    expect(result[LESSON_1]?.map((s) => s.uuid)).toEqual([STEP_2]);
  });

  it('уроки — одним запросом, шаги — одним запросом', async () => {
    seedLesson(LESSON_1, [STEP_1, STEP_2]);
    seedLesson(LESSON_2, [STEP_3]);

    await get([LESSON_1, LESSON_2]);

    expect(env.asked.lessons).toEqual([[LESSON_1, LESSON_2]]);
    expect(env.asked.steps).toHaveLength(1);
    expect([...(env.asked.steps[0] ?? [])].sort()).toEqual(
      [STEP_1, STEP_2, STEP_3].sort(),
    );
    expect(env.asked.lessonById).toEqual([]);
    expect(env.asked.stepById).toEqual([]);
  });

  it('модуль спрашивается один раз на различный moduleId', async () => {
    env.lessons.seed(
      lessonState(LESSON_1, 'published', { stepIds: [STEP_1, STEP_2, STEP_3] }),
    );
    env.steps.seed(
      textStep(STEP_1, 'published'),
      textStep(STEP_2, 'published'),
      textStep(STEP_3, 'published', { moduleId: OTHER_MODULE }),
    );

    await get([LESSON_1]);

    expect([...env.asked.modules].sort()).toEqual(
      [MODULE, OTHER_MODULE].sort(),
    );
  });

  it('уроков нет — ни один модуль не запрашивается', async () => {
    await get([LESSON_3]);

    expect(env.asked.modules).toEqual([]);
  });
});

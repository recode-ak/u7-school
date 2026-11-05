import { describe, expect, it } from 'bun:test';
import { LessonAr } from './lesson/lesson.ar';
import { stored as storedLesson } from './lesson/lesson.fixture';
import type { LessonState } from './lesson/lesson.state';
import { LessonStepsDqs } from './lesson-steps.dqs';
import { MODULE } from './module/module.fixture';
import { StepAr } from './step/step.ar';
import { storedText } from './step/step.fixture';
import type { StepState } from './step/step.state';

// Правила сборки ответа `getStepsByLessons` на уровне домена: порядок по
// `stepIds` урока, пропуск висячих шагов и шагов неизвестного модуля,
// видимость шага по решению Policy, уже принятому вызывающим (`canSee`).

const LESSON_A = '33333333-3333-4333-8333-333333333331';
const LESSON_B = '33333333-3333-4333-8333-333333333332';
const LESSON_C = '33333333-3333-4333-8333-333333333333';
const OTHER_MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9877';
const S1 = '55555555-5555-4555-8555-555555555551';
const S2 = '55555555-5555-4555-8555-555555555552';
const S3 = '55555555-5555-4555-8555-555555555553';
const MISSING = '55555555-5555-4555-8555-555555555559';

const lesson = (
  uuid: string,
  stepIds: string[],
  status: LessonState['status'] = 'published',
) => LessonAr.restore(storedLesson(status, { uuid, stepIds }));

const step = (
  uuid: string,
  status: StepState['status'] = 'published',
  extra: Partial<Extract<StepState, { kind: 'text' }>> = {},
) =>
  StepAr.restore(
    storedText(status, {
      uuid,
      description: `Шаг ${uuid.slice(-1)}`,
      ...extra,
    }),
  );

const open = new Map([[MODULE, true]]);
const closed = new Map([[MODULE, false]]);

describe('LessonStepsDqs.build', () => {
  it('отдаёт только uuid и description шага', () => {
    const result = new LessonStepsDqs(
      [lesson(LESSON_A, [S1])],
      [step(S1)],
      closed,
    ).build();
    expect(result).toEqual({
      [LESSON_A]: [{ uuid: S1, description: 'Шаг 1' }],
    });
  });

  it('несколько уроков — ключ lessonId каждого', () => {
    const result = new LessonStepsDqs(
      [lesson(LESSON_A, [S1]), lesson(LESSON_B, [S2])],
      [step(S1), step(S2)],
      closed,
    ).build();
    expect(Object.keys(result).sort()).toEqual([LESSON_A, LESSON_B]);
    expect(result[LESSON_B]).toEqual([{ uuid: S2, description: 'Шаг 2' }]);
  });

  it('пустые входы — пустой объект', () => {
    expect(new LessonStepsDqs([], [], new Map()).build()).toEqual({});
  });

  it('порядок — по stepIds урока, не по порядку steps', () => {
    const result = new LessonStepsDqs(
      [lesson(LESSON_A, [S3, S1, S2])],
      [step(S1), step(S2), step(S3)],
      closed,
    ).build();
    expect(result[LESSON_A]?.map((it) => it.uuid)).toEqual([S3, S1, S2]);
  });

  it('stepId без шага среди steps пропускается', () => {
    const result = new LessonStepsDqs(
      [lesson(LESSON_A, [S1, MISSING, S2])],
      [step(S1), step(S2)],
      closed,
    ).build();
    expect(result[LESSON_A]?.map((it) => it.uuid)).toEqual([S1, S2]);
  });

  it('шаг модуля, которого нет в canSee, пропускается', () => {
    const result = new LessonStepsDqs(
      [lesson(LESSON_A, [S1, S2])],
      [step(S1), step(S2, 'published', { moduleId: OTHER_MODULE })],
      closed,
    ).build();
    expect(result[LESSON_A]?.map((it) => it.uuid)).toEqual([S1]);
  });

  it('canSee=false: черновой и archived шаги пропускаются, опубликованный отдаётся', () => {
    const result = new LessonStepsDqs(
      [lesson(LESSON_A, [S1, S2, S3])],
      [step(S1, 'draft'), step(S2, 'published'), step(S3, 'archived')],
      closed,
    ).build();
    expect(result[LESSON_A]?.map((it) => it.uuid)).toEqual([S2]);
  });

  it('canSee=true: отдаются шаги всех статусов', () => {
    const result = new LessonStepsDqs(
      [lesson(LESSON_A, [S1, S2, S3])],
      [step(S1, 'draft'), step(S2, 'published'), step(S3, 'archived')],
      open,
    ).build();
    expect(result[LESSON_A]?.map((it) => it.uuid)).toEqual([S1, S2, S3]);
  });

  it('шаги разных модулей в одном уроке — решение по модулю каждого шага', () => {
    const result = new LessonStepsDqs(
      [lesson(LESSON_A, [S1, S2, S3])],
      [
        step(S1, 'draft'),
        step(S2, 'draft', { moduleId: OTHER_MODULE }),
        step(S3, 'published', { moduleId: OTHER_MODULE }),
      ],
      new Map([
        [MODULE, true],
        [OTHER_MODULE, false],
      ]),
    ).build();
    expect(result[LESSON_A]?.map((it) => it.uuid)).toEqual([S1, S3]);
  });

  it('урок без видимых шагов не попадает в ответ', () => {
    const result = new LessonStepsDqs(
      [lesson(LESSON_A, [S1]), lesson(LESSON_B, [S2])],
      [step(S1, 'draft'), step(S2)],
      closed,
    ).build();
    expect(Object.keys(result)).toEqual([LESSON_B]);
  });

  it('урок с пустым stepIds не попадает в ответ', () => {
    const result = new LessonStepsDqs(
      [lesson(LESSON_C, []), lesson(LESSON_A, [S1])],
      [step(S1)],
      closed,
    ).build();
    expect(Object.keys(result)).toEqual([LESSON_A]);
  });

  it('видимость самого урока не проверяется: черновой урок отдаётся', () => {
    const result = new LessonStepsDqs(
      [lesson(LESSON_A, [S1], 'draft')],
      [step(S1)],
      closed,
    ).build();
    expect(result[LESSON_A]).toEqual([{ uuid: S1, description: 'Шаг 1' }]);
  });

  it('не меняет вход: stepIds уроков прежние', () => {
    const lessons = [lesson(LESSON_A, [S3, S1, MISSING])];
    new LessonStepsDqs(lessons, [step(S1), step(S3, 'draft')], closed).build();
    expect(lessons[0]?.stepIds()).toEqual([S3, S1, MISSING]);
  });
});

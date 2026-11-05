import { describe, expect, it } from 'bun:test';
import { LessonAr } from './lesson.ar';
import { LessonErrors } from './lesson.errors';
import { LESSON, MODULE, STEP_1, STEP_2, stored, T0 } from './lesson.fixture';

// Перенос `a-root.test.ts`: `getVisibleFor` (6) на `viewFor(canSeeUnpublished)`.
// Решение «видит ли черновики» принимает Policy модуля-владельца; Ar отвечает
// по готовому флагу. `create` (3) — authoring, не переносится.

const restore = (...args: Parameters<typeof stored>) =>
  LessonAr.restore(stored(...args));

describe('LessonAr.isPublished / moduleId', () => {
  it('published — опубликован', () => {
    expect(restore('published').isPublished()).toBe(true);
  });

  it.each(['draft', 'archived'] as const)('%s — не опубликован', (status) => {
    expect(restore(status).isPublished()).toBe(false);
  });

  it('moduleId — модуль-владелец (связь, DOM-04)', () => {
    expect(restore('draft').moduleId).toBe(MODULE);
  });
});

describe('LessonAr.viewFor — без права на неопубликованное (гость, студент)', () => {
  it('draft — undefined (getVisibleFor: «DRAFT → null»)', () => {
    expect(restore('draft').viewFor(false)).toBeUndefined();
  });

  it('archived — undefined', () => {
    expect(restore('archived').viewFor(false)).toBeUndefined();
  });

  it('published — виден («PUBLISHED → урок»)', () => {
    expect(restore('published').viewFor(false)?.title).toBe('Урок 1');
  });
});

describe('LessonAr.viewFor — с правом на неопубликованное (автор, админ)', () => {
  it.each(['draft', 'published', 'archived'] as const)('%s виден', (status) => {
    expect(restore(status).viewFor(true)?.status).toBe(status);
  });

  it('представление — состояние урока: даты числами, version, шаги', () => {
    const view = restore('published', {
      additional: 'Доп',
      estimatedMinutes: 30,
      mentorStepIds: [STEP_2],
    }).viewFor(true);
    expect(view).toMatchObject({
      uuid: LESSON,
      moduleId: MODULE,
      title: 'Урок 1',
      additional: 'Доп',
      estimatedMinutes: 30,
      stepIds: [STEP_1, STEP_2],
      mentorStepIds: [STEP_2],
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    });
  });

  it('те же поля у published и без права', () => {
    const ar = restore('published');
    expect(ar.viewFor(false)).toEqual(ar.viewFor(true));
  });
});

describe('LessonAr.stepIds — шаги урока для навигации', () => {
  it('порядок урока сохраняется; пустой урок — []', () => {
    expect(
      restore('published', { stepIds: [STEP_2, STEP_1] }).stepIds(),
    ).toEqual([STEP_2, STEP_1]);
    expect(restore('published', { stepIds: [] }).stepIds()).toEqual([]);
  });

  it('наружу — копия: правка ответа не меняет урок', () => {
    const ar = restore('published');
    ar.stepIds().reverse();
    expect(ar.stepIds()).toEqual([STEP_1, STEP_2]);
  });
});

describe('LessonAr.outline — вклад в снимок', () => {
  it('lessonId, lessonTitle, stepIds — и только они', () => {
    const outline = restore('published').outline();
    expect(outline).toEqual({
      lessonId: LESSON,
      lessonTitle: 'Урок 1',
      stepIds: [STEP_1, STEP_2],
    });
    expect(Object.keys(outline).sort()).toEqual([
      'lessonId',
      'lessonTitle',
      'stepIds',
    ]);
  });

  it('stepIds в порядке урока; пустой урок — []', () => {
    expect(
      restore('published', { stepIds: [STEP_2, STEP_1] }).outline().stepIds,
    ).toEqual([STEP_2, STEP_1]);
    expect(restore('published', { stepIds: [] }).outline().stepIds).toEqual([]);
  });
});

describe('LessonErrors', () => {
  it('LESSON_NOT_FOUND — not_found, «Урок не найден»', () => {
    expect(LessonErrors.NOT_FOUND.kind).toBe('not_found');
    expect(LessonErrors.NOT_FOUND.label).toBe('Урок не найден');
    expect(LessonErrors.NOT_FOUND.make({ lessonId: LESSON }).payload).toEqual({
      lessonId: LESSON,
    });
  });
});

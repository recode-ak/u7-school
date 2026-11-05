import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import {
  CourseModuleDef,
  GetLessonUcDef,
  LessonErrors,
  ModuleErrors,
} from '../../contract';

// Контракт `getLesson` (бывш. `get-lesson-uc`): вход `{ lessonId }` вместо
// `uuid` (Т8), выход — `LessonView`. Отказ видимости — `ACCESS_DENIED` ядра,
// не `LESSON_ACCESS_DENIED`.

const LESSON = '33333333-3333-4333-8333-333333333333';
const MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
const STEP = '55555555-5555-4555-8555-555555555555';
const T0 = Date.UTC(2026, 6, 8, 18, 35);

const view: v.InferOutput<typeof GetLessonUcDef.output> = {
  uuid: LESSON,
  moduleId: MODULE,
  title: 'Урок 1',
  status: 'published',
  stepIds: [STEP],
  mentorStepIds: [],
  createdAt: T0,
  updatedAt: T0,
  version: 0,
};

describe('GetLessonUcDef', () => {
  it('query над агрегатом lesson для user и guest, allowAll, две ошибки', () => {
    expect(normalize(GetLessonUcDef)).toMatchObject({
      name: 'getLesson',
      type: 'query',
      aggregate: 'lesson',
      callers: ['user', 'guest'],
      errors: ['LESSON_NOT_FOUND', 'MODULE_NOT_FOUND'],
    });
    expect(GetLessonUcDef.policy.op).toBe('allowAll');
  });

  it('ошибки: LESSON_NOT_FOUND своя, MODULE_NOT_FOUND — по ссылке (ERR-03)', () => {
    expect(GetLessonUcDef.errors).toContain(LessonErrors.NOT_FOUND);
    expect(GetLessonUcDef.errors).toContain(ModuleErrors.NOT_FOUND);
    expect(LessonErrors.NOT_FOUND.kind).toBe('not_found');
  });

  it('вход — uuid урока', () => {
    const { input } = GetLessonUcDef;
    expect(v.parse(input, { lessonId: LESSON })).toEqual({ lessonId: LESSON });
    expect(v.safeParse(input, { lessonId: 'x' }).success).toBe(false);
    expect(v.safeParse(input, { uuid: LESSON }).success).toBe(false);
    expect(v.safeParse(input, {}).success).toBe(false);
  });

  it('выход — LessonView: состояние урока с датами-числами и version', () => {
    const { output } = GetLessonUcDef;
    expect(v.parse(output, view)).toEqual(view);
    expect(
      v.parse(output, { ...view, additional: 'Доп', estimatedMinutes: 30 }),
    ).toMatchObject({ additional: 'Доп', estimatedMinutes: 30 });
    expect(v.safeParse(output, { ...view, title: '' }).success).toBe(false);
    expect(v.safeParse(output, { ...view, stepIds: ['x'] }).success).toBe(
      false,
    );
    expect(v.safeParse(output, { ...view, status: 'nonsense' }).success).toBe(
      false,
    );
  });

  it('поля выхода описаны (MAN-02)', () => {
    for (const field of Object.values(GetLessonUcDef.output.entries)) {
      expect(v.getDescription(field)).toBeString();
    }
  });

  it('входит в паспорт CourseModuleDef', () => {
    expect(normalize(CourseModuleDef).useCases).toContain('getLesson');
  });
});

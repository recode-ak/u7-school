import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { CourseModuleDef, GetStepsByLessonsUcDef } from '../../contract';

// Контракт `getStepsByLessons`: шаги, сгруппированные по уроку (uuid +
// description). Ошибок нет: нет уроков → `{}`, модуль шага не найден → шаг
// пропускается (Т5).

const LESSON = '33333333-3333-4333-8333-333333333333';
const LESSON_2 = '44444444-4444-4444-8444-444444444444';
const STEP = '55555555-5555-4555-8555-555555555555';

describe('GetStepsByLessonsUcDef', () => {
  it('query над агрегатом step для user и guest, allowAll, без ошибок', () => {
    expect(normalize(GetStepsByLessonsUcDef)).toMatchObject({
      name: 'getStepsByLessons',
      type: 'query',
      aggregate: 'step',
      callers: ['user', 'guest'],
      errors: [],
    });
    expect(GetStepsByLessonsUcDef.policy.op).toBe('allowAll');
  });

  it('вход — список uuid уроков, в т. ч. пустой', () => {
    const { input } = GetStepsByLessonsUcDef;
    expect(v.parse(input, { lessonIds: [LESSON, LESSON_2] })).toEqual({
      lessonIds: [LESSON, LESSON_2],
    });
    expect(v.parse(input, { lessonIds: [] })).toEqual({ lessonIds: [] });
    expect(v.safeParse(input, { lessonIds: ['x'] }).success).toBe(false);
    expect(v.safeParse(input, {}).success).toBe(false);
  });

  it('выход — запись «урок → шаги {uuid, description}», в т. ч. пустая', () => {
    const { output } = GetStepsByLessonsUcDef;
    const out = { [LESSON]: [{ uuid: STEP, description: 'Шаг 1' }] };
    expect(v.parse(output, out)).toEqual(out);
    expect(v.parse(output, {})).toEqual({});
  });

  it.each([
    ['ключ не uuid', { x: [{ uuid: STEP, description: 'Шаг' }] }],
    ['uuid шага не uuid', { [LESSON]: [{ uuid: 'x', description: 'Шаг' }] }],
    ['нет description', { [LESSON]: [{ uuid: STEP }] }],
    ['значение не массив', { [LESSON]: { uuid: STEP, description: 'Шаг' } }],
  ])('выход: %s — отказ', (_, out) => {
    expect(v.safeParse(GetStepsByLessonsUcDef.output, out).success).toBe(false);
  });

  it('входит в паспорт CourseModuleDef', () => {
    expect(normalize(CourseModuleDef).useCases).toContain('getStepsByLessons');
  });
});

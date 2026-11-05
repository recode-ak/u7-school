import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { CourseModuleDef } from '../../contract';
import { COURSE, M1, M2, M3 } from '../course.fixture';
import { GetModulePlaceUcDef } from './get-module-place.uc';

// Def `getModulePlace` (Т7, Т17): место модуля в опубликованном курсе с
// необязательным `stage`; пусто — не ошибка. Вызывает бот из реакции на
// событие (как гость).

describe('GetModulePlaceUcDef', () => {
  it('query над агрегатом курса для user и guest, allowAll, без ошибок', () => {
    expect(normalize(GetModulePlaceUcDef)).toMatchObject({
      name: 'getModulePlace',
      type: 'query',
      aggregate: 'course',
      callers: ['user', 'guest'],
      errors: [],
    });
    expect(GetModulePlaceUcDef.policy.op).toBe('allowAll');
  });

  it('вход — { moduleId } uuid', () => {
    const { input } = GetModulePlaceUcDef;
    expect(v.parse(input, { moduleId: M1 })).toEqual({ moduleId: M1 });
    expect(v.safeParse(input, { moduleId: 'x' }).success).toBe(false);
    expect(v.safeParse(input, {}).success).toBe(false);
  });

  it('выход: место без соседей и этапа', () => {
    const place = { courseId: COURSE, isFirst: true, isLast: true };
    expect(v.parse(GetModulePlaceUcDef.output, place)).toEqual(place);
  });

  it('выход: место со всеми необязательными полями', () => {
    const place = {
      courseId: COURSE,
      isFirst: false,
      isLast: false,
      prevModuleId: M1,
      nextModuleId: M3,
      stage: { index: 1, title: 'Алгоритмика', track: 'tech' },
    };
    expect(v.parse(GetModulePlaceUcDef.output, place)).toEqual(place);
  });

  it('выход: stage без track допустим', () => {
    const place = {
      courseId: COURSE,
      isFirst: false,
      isLast: true,
      prevModuleId: M2,
      stage: { index: 0, title: 'Основы' },
    };
    expect(v.parse(GetModulePlaceUcDef.output, place)).toEqual(place);
  });

  it('выход: пусто (модуль вне опубликованных курсов)', () => {
    expect(v.parse(GetModulePlaceUcDef.output, undefined)).toBeUndefined();
  });

  it.each([
    ['без courseId', { isFirst: true, isLast: true }],
    ['courseId не uuid', { courseId: 'x', isFirst: true, isLast: true }],
    ['без isFirst', { courseId: COURSE, isLast: true }],
    ['без isLast', { courseId: COURSE, isFirst: true }],
    [
      'prevModuleId не uuid',
      { courseId: COURSE, isFirst: false, isLast: true, prevModuleId: 'x' },
    ],
    [
      'stage без title',
      { courseId: COURSE, isFirst: true, isLast: true, stage: { index: 0 } },
    ],
  ])('выход: %s — отказ', (_, out) => {
    expect(v.safeParse(GetModulePlaceUcDef.output, out).success).toBe(false);
  });

  it('входит в паспорт CourseModuleDef', () => {
    expect(normalize(CourseModuleDef).useCases).toContain('getModulePlace');
  });
});

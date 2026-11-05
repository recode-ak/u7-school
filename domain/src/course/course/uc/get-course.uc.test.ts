import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { CourseModuleDef, CourseView } from '../../contract';
import { CourseAr } from '../course.ar';
import { COURSE, stored } from '../course.fixture';
import { GetCourseUcDef } from './get-course.uc';

// Def `getCourse` (Р5, Т5): вход `{ courseId }` вместо legacy `uuid`, выход —
// `CourseView` со `stages`; курс виден любого статуса (вариант А С1).

describe('GetCourseUcDef', () => {
  it('query над агрегатом курса для user и guest, allowAll, ошибка — курс не найден', () => {
    expect(normalize(GetCourseUcDef)).toMatchObject({
      name: 'getCourse',
      type: 'query',
      aggregate: 'course',
      callers: ['user', 'guest'],
      errors: ['COURSE_NOT_FOUND'],
    });
    expect(GetCourseUcDef.policy.op).toBe('allowAll');
  });

  it('ошибка COURSE_NOT_FOUND — not_found с courseId в payload', () => {
    const [error] = GetCourseUcDef.errors;
    expect(error?.code).toBe('COURSE_NOT_FOUND');
    expect(error?.kind).toBe('not_found');
    expect(
      v.safeParse(error?.payload as v.GenericSchema, { courseId: COURSE })
        .success,
    ).toBe(true);
    expect(
      v.safeParse(error?.payload as v.GenericSchema, { courseId: 'x' }).success,
    ).toBe(false);
  });

  it('вход — { courseId } uuid', () => {
    const { input } = GetCourseUcDef;
    expect(v.parse(input, { courseId: COURSE })).toEqual({ courseId: COURSE });
    expect(v.safeParse(input, { courseId: 'x' }).success).toBe(false);
    expect(v.safeParse(input, { uuid: COURSE }).success).toBe(false);
    expect(v.safeParse(input, {}).success).toBe(false);
  });

  it('выход — CourseView, в том числе курс без этапов', () => {
    const { output } = GetCourseUcDef;
    expect(output).toBe(CourseView);
    for (const extra of [{}, { phases: [] }]) {
      const view = CourseAr.restore(stored('draft', extra)).view();
      expect(v.parse(output, view)).toEqual(view);
    }
  });

  it('входит в паспорт CourseModuleDef', () => {
    expect(normalize(CourseModuleDef).useCases).toContain('getCourse');
  });
});

import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { CourseModuleDef } from '../../contract';
import { CourseAr } from '../course.ar';
import { M1, stored } from '../course.fixture';
import { GetCourseByModuleUcDef } from './get-course-by-module.uc';

// Def `getCourseByModule` (Т17): пусто — не ошибка, поэтому выход
// необязателен и ошибок у UC нет.

describe('GetCourseByModuleUcDef', () => {
  it('query над агрегатом курса для user и guest, allowAll, без ошибок', () => {
    expect(normalize(GetCourseByModuleUcDef)).toMatchObject({
      name: 'getCourseByModule',
      type: 'query',
      aggregate: 'course',
      callers: ['user', 'guest'],
      errors: [],
    });
    expect(GetCourseByModuleUcDef.policy.op).toBe('allowAll');
  });

  it('вход — { moduleId } uuid', () => {
    const { input } = GetCourseByModuleUcDef;
    expect(v.parse(input, { moduleId: M1 })).toEqual({ moduleId: M1 });
    expect(v.safeParse(input, { moduleId: 'x' }).success).toBe(false);
    expect(v.safeParse(input, {}).success).toBe(false);
  });

  it('выход: CourseView или пусто', () => {
    const { output } = GetCourseByModuleUcDef;
    const view = CourseAr.restore(stored('archived')).view();
    expect(v.parse(output, view)).toEqual(view);
    expect(v.parse(output, undefined)).toBeUndefined();
    expect(v.safeParse(output, { uuid: 'x' }).success).toBe(false);
  });

  it('входит в паспорт CourseModuleDef', () => {
    expect(normalize(CourseModuleDef).useCases).toContain('getCourseByModule');
  });
});

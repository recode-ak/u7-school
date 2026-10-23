import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { GetCoursesIncludingModuleUcDef } from './get-courses-including-module.uc';

const MODULE = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const COURSE = '6c1d9a4e-2b7f-4e3a-8d5c-9f0e1a2b3c4d';

describe('GetCoursesIncludingModuleUcDef', () => {
  it('query для других модулей над агрегатом курса, без ограничений и ошибок', () => {
    expect(normalize(GetCoursesIncludingModuleUcDef)).toMatchObject({
      name: 'getCoursesIncludingModule',
      type: 'query',
      aggregate: 'course',
      callers: ['system'],
      errors: [],
    });
    expect(GetCoursesIncludingModuleUcDef.policy.op).toBe('allowAll');
  });

  it('вход — uuid модуля и uuid курсов-кандидатов', () => {
    const { input } = GetCoursesIncludingModuleUcDef;
    const value = { moduleId: MODULE, courseIds: [COURSE] };
    expect(v.parse(input, value)).toEqual(value);
    expect(v.parse(input, { moduleId: MODULE, courseIds: [] })).toEqual({
      moduleId: MODULE,
      courseIds: [],
    });
    expect(
      v.safeParse(input, { moduleId: MODULE, courseIds: ['x'] }).success,
    ).toBe(false);
    expect(v.safeParse(input, { courseIds: [COURSE] }).success).toBe(false);
  });

  it('выход — uuid курсов, включающих модуль', () => {
    const { output } = GetCoursesIncludingModuleUcDef;
    expect(v.parse(output, { courseIds: [COURSE] })).toEqual({
      courseIds: [COURSE],
    });
    expect(v.safeParse(output, {}).success).toBe(false);
  });
});

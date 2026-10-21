import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { GetCourseEnrollmentUcDef } from './get-course-enrollment.uc';

const COURSE = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const MODULE = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';

describe('GetCourseEnrollmentUcDef', () => {
  it('query для других модулей над агрегатом курса, без ограничений и ошибок', () => {
    expect(normalize(GetCourseEnrollmentUcDef)).toMatchObject({
      name: 'getCourseEnrollment',
      type: 'query',
      aggregate: 'course',
      callers: ['module'],
      errors: [],
    });
    expect(GetCourseEnrollmentUcDef.policy.op).toBe('allowAll');
  });

  it('вход — uuid курса', () => {
    const { input } = GetCourseEnrollmentUcDef;
    expect(v.parse(input, { courseId: COURSE })).toEqual({ courseId: COURSE });
    expect(v.safeParse(input, { courseId: 'x' }).success).toBe(false);
  });

  it('выход: доступен — со стартовым модулем; недоступен — без него', () => {
    const { output } = GetCourseEnrollmentUcDef;
    const open = { enrollable: true, startModuleId: MODULE };
    expect(v.parse(output, open)).toEqual(open);
    expect(v.parse(output, { enrollable: false })).toEqual({
      enrollable: false,
    });
    expect(v.safeParse(output, { enrollable: true }).success).toBe(false);
  });
});

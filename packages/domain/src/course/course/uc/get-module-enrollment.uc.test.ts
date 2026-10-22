import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { GetModuleEnrollmentUcDef } from './get-module-enrollment.uc';

const MODULE = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';

describe('GetModuleEnrollmentUcDef', () => {
  it('query для других модулей над агрегатом курса, без ограничений и ошибок', () => {
    expect(normalize(GetModuleEnrollmentUcDef)).toMatchObject({
      name: 'getModuleEnrollment',
      type: 'query',
      aggregate: 'course',
      callers: ['system'],
      errors: [],
    });
    expect(GetModuleEnrollmentUcDef.policy.op).toBe('allowAll');
  });

  it('вход — uuid модуля', () => {
    const { input } = GetModuleEnrollmentUcDef;
    expect(v.parse(input, { moduleId: MODULE })).toEqual({ moduleId: MODULE });
    expect(v.safeParse(input, { moduleId: 'x' }).success).toBe(false);
  });

  it.each([true, false])('выход — enrollable %s', (enrollable) => {
    const { output } = GetModuleEnrollmentUcDef;
    expect(v.parse(output, { enrollable })).toEqual({ enrollable });
    expect(v.safeParse(output, {}).success).toBe(false);
  });
});

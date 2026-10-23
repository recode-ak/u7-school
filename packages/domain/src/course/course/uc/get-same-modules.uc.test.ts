import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { GetSameModulesUcDef } from './get-same-modules.uc';

const MODULE = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const OTHER = '6c1d9a4e-2b7f-4e3a-8d5c-9f0e1a2b3c4d';

describe('GetSameModulesUcDef', () => {
  it('query для других модулей над агрегатом курса, без ограничений и ошибок', () => {
    expect(normalize(GetSameModulesUcDef)).toMatchObject({
      name: 'getSameModules',
      type: 'query',
      aggregate: 'course',
      callers: ['system'],
      errors: [],
    });
    expect(GetSameModulesUcDef.policy.op).toBe('allowAll');
  });

  it('вход — uuid модуля и uuid модулей-кандидатов', () => {
    const { input } = GetSameModulesUcDef;
    const value = { moduleId: MODULE, moduleIds: [MODULE, OTHER] };
    expect(v.parse(input, value)).toEqual(value);
    expect(
      v.safeParse(input, { moduleId: MODULE, moduleIds: ['x'] }).success,
    ).toBe(false);
    expect(v.safeParse(input, { moduleIds: [OTHER] }).success).toBe(false);
  });

  it('выход — uuid модулей, исторически тех же', () => {
    const { output } = GetSameModulesUcDef;
    expect(v.parse(output, { moduleIds: [MODULE] })).toEqual({
      moduleIds: [MODULE],
    });
    expect(v.safeParse(output, {}).success).toBe(false);
  });
});

import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { CourseModuleDef, GetModulePrerequisiteUcDef } from '../../contract';

// Условие допуска к модулю — Def UC `course` для `enrollStudent`.
// Выход — variant по `gate`: none | module | closed.

const MODULE = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';

describe('GetModulePrerequisiteUcDef', () => {
  it('query для других модулей (system) над агрегатом курса, allowAll, без ошибок', () => {
    expect(normalize(GetModulePrerequisiteUcDef)).toMatchObject({
      name: 'getModulePrerequisite',
      type: 'query',
      aggregate: 'course',
      callers: ['system'],
      errors: [],
    });
    expect(GetModulePrerequisiteUcDef.policy.op).toBe('allowAll');
  });

  it('вход — uuid модуля', () => {
    const { input } = GetModulePrerequisiteUcDef;
    expect(v.parse(input, { moduleId: MODULE })).toEqual({ moduleId: MODULE });
    expect(v.safeParse(input, { moduleId: 'x' }).success).toBe(false);
    expect(v.safeParse(input, {}).success).toBe(false);
  });

  it.each([
    { gate: 'none' },
    { gate: 'closed' },
    { gate: 'module', moduleId: MODULE, title: 'Основы' },
  ])('выход: %o валиден', (out) => {
    expect(v.parse(GetModulePrerequisiteUcDef.output, out)).toEqual(out);
  });

  it.each([
    ['чужой gate', { gate: 'open' }],
    ['module без title', { gate: 'module', moduleId: MODULE }],
    ['module без moduleId', { gate: 'module', title: 'Основы' }],
    [
      'module с неверным moduleId',
      { gate: 'module', moduleId: 'x', title: 'Т' },
    ],
    ['без gate', {}],
  ])('выход: %s — отказ', (_, out) => {
    expect(v.safeParse(GetModulePrerequisiteUcDef.output, out).success).toBe(
      false,
    );
  });

  it('входит в паспорт CourseModuleDef', () => {
    expect(normalize(CourseModuleDef).useCases).toContain(
      'getModulePrerequisite',
    );
  });
});

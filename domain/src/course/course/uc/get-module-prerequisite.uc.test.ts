import { describe, expect, it } from 'bun:test';
import { toJsonSchema } from 'dmg-core';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { CourseModuleDef, GetModulePrerequisiteUcDef } from '../../contract';

// Условие допуска к модулю — Def UC `course` для `enrollStudent` (D-65).
// Вход: `moduleId` и `passedModuleIds` (принадлежность решает курс). Выход —
// вердикт по `admitted`: допущен | не допущен с причиной
// (`previous-not-passed` с названием, `closed`). Вложенный `variant` (Т9).

const MODULE = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const PREV = '12345678-1234-4234-8234-123456789012';

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

  it('вход — uuid модуля и пройденные модули', () => {
    const { input } = GetModulePrerequisiteUcDef;
    const full = { moduleId: MODULE, passedModuleIds: [PREV] };
    expect(v.parse(input, full)).toEqual(full);
    expect(v.parse(input, { moduleId: MODULE, passedModuleIds: [] })).toEqual({
      moduleId: MODULE,
      passedModuleIds: [],
    });
  });

  it.each([
    ['moduleId не uuid', { moduleId: 'x', passedModuleIds: [] }],
    ['нет moduleId', { passedModuleIds: [] }],
    ['нет passedModuleIds', { moduleId: MODULE }],
    ['passedModuleIds не массив', { moduleId: MODULE, passedModuleIds: PREV }],
    ['passedModuleIds с не-uuid', { moduleId: MODULE, passedModuleIds: ['x'] }],
  ])('вход: %s — отказ', (_, input) => {
    expect(v.safeParse(GetModulePrerequisiteUcDef.input, input).success).toBe(
      false,
    );
  });

  it('у каждого поля входа есть описание (MAN-02)', () => {
    for (const field of Object.values(
      GetModulePrerequisiteUcDef.input.entries,
    )) {
      expect(v.getDescription(field as v.GenericSchema)).toBeString();
    }
  });

  it.each([
    { admitted: true },
    { admitted: false, reason: 'closed' },
    { admitted: false, reason: 'previous-not-passed', title: 'Основы' },
  ])('выход: %o валиден', (out) => {
    expect(v.parse(GetModulePrerequisiteUcDef.output, out)).toEqual(out);
  });

  it.each([
    ['прежний gate', { gate: 'none' }],
    ['без admitted', {}],
    ['не допущен без причины', { admitted: false }],
    ['чужая причина', { admitted: false, reason: 'open' }],
    [
      'previous-not-passed без title',
      { admitted: false, reason: 'previous-not-passed' },
    ],
    ['admitted не boolean', { admitted: 'yes' }],
  ])('выход: %s — отказ', (_, out) => {
    expect(v.safeParse(GetModulePrerequisiteUcDef.output, out).success).toBe(
      false,
    );
  });

  it('JSON Schema выхода строится (вложенный variant на одном дискриминаторе, Т9)', () => {
    expect(() => toJsonSchema(GetModulePrerequisiteUcDef.output)).not.toThrow();
    expect(normalize(GetModulePrerequisiteUcDef).output).toBeDefined();
  });

  it('входит в паспорт CourseModuleDef', () => {
    expect(normalize(CourseModuleDef).useCases).toContain(
      'getModulePrerequisite',
    );
  });
});

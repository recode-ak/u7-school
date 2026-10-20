import { describe, expect, it } from 'bun:test';
import { checkDefs, formatViolation } from 'dmg-core/arch';
import { indexDefs, normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { QuestionnaireEvents, QuestionnaireModuleDef } from './contract';

const base = {
  questionnaireId: '11111111-1111-4111-8111-111111111111',
  respondentId: '22222222-2222-4222-8222-222222222222',
  owner: { kind: 'wish', wishId: 'w-1' },
};

describe('QuestionnaireModuleDef — внешний модуль (D-37)', () => {
  it('паспорт: внешний, зависит от user, агрегат questionnaire', () => {
    expect(QuestionnaireModuleDef.external).toBe(true);
    expect(normalize(QuestionnaireModuleDef)).toMatchObject({
      dependsOn: ['user'],
      aggregates: ['questionnaire'],
      useCases: [],
      reactions: [],
      jobs: [],
    });
  });

  it('checkDefs по модулю и зависимостям — без нарушений', () => {
    expect(
      checkDefs(indexDefs([QuestionnaireModuleDef])).map(formatViolation),
    ).toEqual([]);
  });

  it('completed — FQN и payload: owner модуль анкет не толкует', () => {
    const { completed } = QuestionnaireEvents;
    expect(completed.name).toBe('questionnaire.questionnaire.completed');
    expect(v.parse(completed.payload, base)).toEqual(base);
    const { owner: _, ...noOwner } = base;
    expect(v.safeParse(completed.payload, noOwner).success).toBe(false);
  });

  it('abandoned — FQN, reason необязателен и из перечня', () => {
    const { abandoned } = QuestionnaireEvents;
    expect(abandoned.name).toBe('questionnaire.questionnaire.abandoned');
    expect(v.parse(abandoned.payload, base)).toEqual(base);
    expect(v.parse(abandoned.payload, { ...base, reason: 'timeout' })).toEqual({
      ...base,
      reason: 'timeout',
    });
    expect(
      v.safeParse(abandoned.payload, { ...base, reason: 'other' }).success,
    ).toBe(false);
  });
});

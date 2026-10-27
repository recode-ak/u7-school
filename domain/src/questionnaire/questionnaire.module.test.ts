import { describe, expect, it } from 'bun:test';
import {
  AggregateDef,
  allowAll,
  BaseEntityFields,
  ErrorDef,
  ModuleDef,
  UseCaseDef,
} from 'dmg-core';
import { ArchChecker } from 'dmg-core/arch';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import {
  QuestionnaireEvents,
  QuestionnaireModuleDef,
  StartQuestionnaireUcDef,
} from './contract';

const base = {
  questionnaireId: '11111111-1111-4111-8111-111111111111',
  respondentId: '22222222-2222-4222-8222-222222222222',
  owner: { kind: 'wish', wishId: 'w-1' },
};

describe('QuestionnaireModuleDef — внешний модуль (D-37)', () => {
  it('паспорт: внешний, зависит от user, агрегат и Def UC без реализации', () => {
    expect(QuestionnaireModuleDef.external).toBe(true);
    expect(normalize(QuestionnaireModuleDef)).toMatchObject({
      dependsOn: ['user'],
      aggregates: ['questionnaire'],
      useCases: ['startQuestionnaire'],
      reactions: [],
      jobs: [],
    });
  });

  it('ArchChecker по модулю и зависимостям — без нарушений', () => {
    expect(ArchChecker.defsOf([QuestionnaireModuleDef]).report()).toEqual([]);
  });

  it('completed — FQN и payload: owner модуль анкет не толкует', () => {
    const { completed } = QuestionnaireEvents;
    expect(completed.name).toBe('questionnaire.questionnaire.completed');
    expect(v.parse(completed.payload, base)).toEqual(base);
    const { owner: _, ...noOwner } = base;
    expect(v.safeParse(completed.payload, noOwner).success).toBe(false);
  });

  it('started — FQN и payload как у completed', () => {
    const { started } = QuestionnaireEvents;
    expect(started.name).toBe('questionnaire.questionnaire.started');
    expect(v.parse(started.payload, base)).toEqual(base);
  });

  it('UC вызывается другим модулем по calls (D-42) — без нарушений', () => {
    const ProbeArDef = AggregateDef.define({
      name: 'probe',
      label: 'Проба',
      description: 'Агрегат модуля-потребителя.',
      state: v.object({ ...BaseEntityFields }),
      events: {},
      errors: ErrorDef.define('PROBE', {}),
    });
    const consumer = ModuleDef.define({
      name: 'probe',
      label: 'Проба',
      description: 'Модуль-потребитель для проверки контракта.',
      dependsOn: [QuestionnaireModuleDef],
      aggregates: [ProbeArDef],
      useCases: [
        UseCaseDef.define({
          name: 'probeStart',
          label: 'Проба анкеты',
          description: 'Запускает анкету через фасад модуля анкет.',
          type: 'command',
          aggregate: ProbeArDef,
          callers: ['user'],
          policy: allowAll,
          calls: [StartQuestionnaireUcDef],
          input: v.object({}),
          output: v.object({}),
          errors: [],
        }),
      ],
      reactions: [],
      jobs: [],
    });
    expect(ArchChecker.defsOf([consumer]).report()).toEqual([]);
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

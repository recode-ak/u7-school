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
import * as contract from './contract';
import {
  QuestionnaireErrors,
  QuestionnaireEvents,
  QuestionnaireModuleDef,
  StartQuestionnaireUcDef,
  SweepAbandonedQuestionnairesJobDef,
} from './contract';

// Паспорт модуля после среза: `external` снят (иначе нельзя объявить Job, MAN-06),
// 9 UC, 1 Job, 6 событий. Заменяет ожидания внешнего модуля (external, 1 UC, jobs: []).

const base = {
  questionnaireId: '11111111-1111-4111-8111-111111111111',
  respondentId: '22222222-2222-4222-8222-222222222222',
  kind: 'standard' as const,
  ownerInfo: { kind: 'wish', wishId: 'w-1' },
};

const UC = [
  'startQuestionnaire',
  'sendLikertInvite',
  'startByInvite',
  'declineInvite',
  'handleAction',
  'abandon',
  'getQuestionnaire',
  'getCurrent',
  'getQuestionnairesByUser',
];

describe('QuestionnaireModuleDef', () => {
  it('модуль не внешний', () => {
    expect(QuestionnaireModuleDef.external).toBeFalsy();
  });

  it('паспорт: зависит от user, агрегат questionnaire, 9 UC, один Job, ER нет', () => {
    const def = normalize(QuestionnaireModuleDef);
    expect(def).toMatchObject({
      dependsOn: ['user'],
      aggregates: ['questionnaire'],
      reactions: [],
      jobs: ['sweepAbandonedQuestionnaires'],
    });
    expect([...def.useCases].sort()).toEqual([...UC].sort());
  });

  it('ArchChecker по модулю и зависимостям — без нарушений', () => {
    expect(ArchChecker.defsOf([QuestionnaireModuleDef]).report()).toEqual([]);
  });

  it('контракт экспортирует 9 Def UC, Job, события, ошибки и пулы', () => {
    for (const name of [
      'StartQuestionnaireUcDef',
      'SendLikertInviteUcDef',
      'StartByInviteUcDef',
      'DeclineInviteUcDef',
      'HandleActionUcDef',
      'AbandonUcDef',
      'GetQuestionnaireUcDef',
      'GetCurrentUcDef',
      'GetQuestionnairesByUserUcDef',
      'SweepAbandonedQuestionnairesJobDef',
      'QuestionnaireEvents',
      'QuestionnaireErrors',
      'QuestionnairePoolSchema',
    ]) {
      expect(contract).toHaveProperty(name);
    }
    expect(Object.keys(QuestionnaireErrors)).toHaveLength(6);
    expect(SweepAbandonedQuestionnairesJobDef.name).toBe(
      'sweepAbandonedQuestionnaires',
    );
  });

  it('completed — FQN и payload: ownerInfo модуль анкет не толкует', () => {
    const { completed } = QuestionnaireEvents;
    expect(completed.name).toBe('questionnaire.questionnaire.completed');
    expect(v.parse(completed.payload, base)).toEqual(base);
    const { ownerInfo: _, ...noOwner } = base;
    expect(v.safeParse(completed.payload, noOwner).success).toBe(false);
  });

  it('abandoned — FQN, reason обязателен и из перечня', () => {
    const { abandoned } = QuestionnaireEvents;
    expect(abandoned.name).toBe('questionnaire.questionnaire.abandoned');
    for (const reason of ['timeout', 'by_user', 'declined'] as const) {
      expect(v.parse(abandoned.payload, { ...base, reason })).toEqual({
        ...base,
        reason,
      });
    }
    expect(v.safeParse(abandoned.payload, base).success).toBe(false);
    expect(
      v.safeParse(abandoned.payload, { ...base, reason: 'other' }).success,
    ).toBe(false);
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
});

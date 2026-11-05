import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import { QuestionnaireModuleDef } from './contract';

// Паспорт модуля после среза: `external` снят (иначе нельзя объявить Job, MAN-06),
// 9 UC, 1 Job. Заменяет ожидания внешнего модуля (external, 1 UC, jobs: []).

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
});

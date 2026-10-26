import { describe, expect, it } from 'bun:test';
import { allowed, denied } from 'dmg-core';
import { QuestionnaireRespondentPolicy } from './questionnaire-respondent.policy';

const { hasRespondent } = QuestionnaireRespondentPolicy.rules;

describe('QuestionnaireRespondentPolicy.hasRespondent', () => {
  it('есть человек-респондент — allowed', () => {
    expect(
      hasRespondent.evaluate(
        { uuid: '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6' },
        {},
      ),
    ).toEqual(allowed);
  });

  it('системный вызов без человека — denied', () => {
    expect(hasRespondent.evaluate(undefined, {})).toEqual(
      denied(
        'hasRespondent',
        'Анкету можно запустить только за человека-респондента.',
      ),
    );
  });
});

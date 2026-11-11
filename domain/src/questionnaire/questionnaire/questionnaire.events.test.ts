import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { QuestionnaireEvents } from './questionnaire.events';

// Событийный контракт (Q1, Q2, Q3; Т12): в payload `ownerInfo` вместо `owner`,
// без `telegramId`/`response`; `likertScores` — score в 1..5 и непустая категория.

const ref = {
  questionnaireId: '11111111-1111-4111-8111-111111111111',
  respondentId: '22222222-2222-4222-8222-222222222222',
  kind: 'standard' as const,
  ownerInfo: { kind: 'wish', wishId: 'w-1' },
};
const scores = [
  { category: 'team_skills', subcategory: 'communication', score: 4 },
];
const valid = (schema: v.GenericSchema, payload: unknown) =>
  v.safeParse(schema, payload).success;

function keysOf(schema: v.GenericSchema): string[] {
  if ('entries' in schema) return Object.keys(schema.entries as object);
  if ('options' in schema) {
    return (schema.options as v.GenericSchema[]).flatMap(keysOf);
  }
  return [];
}

describe('QuestionnaireEvents — payload', () => {
  it('в payload нет telegramId и response; слово owner не используется', () => {
    for (const event of Object.values(QuestionnaireEvents)) {
      const keys = keysOf(event.payload);
      expect(keys).not.toContain('telegramId');
      expect(keys).not.toContain('response');
      expect(keys).not.toContain('owner');
      expect(keys).toContain('ownerInfo');
    }
  });
});

describe('QuestionnaireEvents.completed', () => {
  const { payload } = QuestionnaireEvents.completed;

  it('score вне 1..5 или пустая категория — недопустимы', () => {
    const bad = (s: object) =>
      valid(payload, {
        ...ref,
        kind: 'likert' as const,
        likertScores: [{ ...scores[0], ...s }],
      });
    expect(bad({ score: 0.9 })).toBe(false);
    expect(bad({ score: 5.1 })).toBe(false);
    expect(bad({ score: 1 })).toBe(true);
    expect(bad({ score: 5 })).toBe(true);
    expect(bad({ category: '' })).toBe(false);
  });
});

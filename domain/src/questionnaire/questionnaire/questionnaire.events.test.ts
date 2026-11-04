import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { QuestionnaireEvents } from './questionnaire.events';

// Событийный контракт (Q1, Q2, Q3; Т12): 6 событий, `ownerInfo`,
// обязательные `kind` и `reason`, `likertScores` у likert; без `telegramId`/`response`.

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

describe('QuestionnaireEvents — состав и FQN', () => {
  it('ровно шесть событий', () => {
    expect(Object.keys(QuestionnaireEvents).sort()).toEqual(
      [
        'started',
        'invited',
        'completed',
        'abandoned',
        'abandonWarning',
        'continueInvite',
      ].sort(),
    );
  });

  it.each([
    'started',
    'invited',
    'completed',
    'abandoned',
    'abandonWarning',
    'continueInvite',
  ] as const)('%s: FQN questionnaire.questionnaire.%s', (key) => {
    expect(QuestionnaireEvents[key].name).toBe(
      `questionnaire.questionnaire.${key}`,
    );
  });

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

describe.each([
  'started',
  'invited',
  'abandonWarning',
  'continueInvite',
] as const)('QuestionnaireEvents.%s', (key) => {
  const { payload } = QuestionnaireEvents[key];

  it('payload { questionnaireId, respondentId, kind, ownerInfo } допустим для обоих kind', () => {
    expect(v.parse(payload, ref)).toEqual(ref);
    expect(valid(payload, { ...ref, kind: 'likert' })).toBe(true);
  });

  it('без ownerInfo, kind или с чужим kind/uuid — недопустим', () => {
    const { ownerInfo: _o, ...noOwner } = ref;
    const { kind: _k, ...noKind } = ref;
    expect(valid(payload, noOwner)).toBe(false);
    expect(valid(payload, noKind)).toBe(false);
    expect(valid(payload, { ...ref, kind: 'other' })).toBe(false);
    expect(valid(payload, { ...ref, questionnaireId: 'x' })).toBe(false);
  });

  it('прежнее поле owner вместо ownerInfo не принимается', () => {
    const { ownerInfo, ...rest } = ref;
    expect(valid(payload, { ...rest, owner: ownerInfo })).toBe(false);
  });
});

describe('QuestionnaireEvents.completed', () => {
  const { payload } = QuestionnaireEvents.completed;

  it('standard: ref; likertScores отбрасываются', () => {
    expect(v.parse(payload, ref)).toEqual(ref);
  });

  it('likert: ref + likertScores', () => {
    const likert = { ...ref, kind: 'likert' as const, likertScores: scores };
    expect(v.parse(payload, likert)).toEqual(likert);
  });

  it('likert без likertScores — недопустим', () => {
    expect(valid(payload, { ...ref, kind: 'likert' })).toBe(false);
  });

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

describe('QuestionnaireEvents.abandoned', () => {
  const { payload } = QuestionnaireEvents.abandoned;

  it.each(['timeout', 'by_user', 'declined'] as const)(
    'reason %s допустим',
    (reason) => {
      expect(v.parse(payload, { ...ref, reason })).toEqual({ ...ref, reason });
    },
  );

  it('reason обязателен и из перечня', () => {
    expect(valid(payload, ref)).toBe(false);
    expect(valid(payload, { ...ref, reason: 'other' })).toBe(false);
  });
});

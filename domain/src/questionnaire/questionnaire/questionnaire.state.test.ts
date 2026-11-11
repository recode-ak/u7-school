import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { QuestionnaireArDef } from './questionnaire.ar';
import { likertPool, simplePool } from './questionnaire.fixture';
import type { QuestionnaireState } from './questionnaire.state';

// Перенос `entity.test.ts`-контракта на state по Def (DOM-11/12): даты — числа (UTC),
// legacy-запись с ISO читается, нет `updatedAt` → `createdAt`, нет `version` → 0;
// обе ветки `kind` (variant).

const ISO = '2026-06-01T10:00';
const T = Date.UTC(2026, 5, 1, 10);
const legacyStandard = {
  kind: 'standard',
  uuid: '00000000-0000-4000-8000-000000000042',
  respondentId: '00000000-0000-4000-8000-000000000007',
  status: 'in_progress',
  currentQuestionCode: 'q1',
  draftAnswers: {},
  answers: [
    {
      questionCode: 'q0',
      answerCode: 'a',
      answeredAt: '2026-06-01T10:30:00.000Z',
    },
  ],
  questionPool: simplePool(),
  ownerInfo: { courseId: 'c' },
  createdAt: ISO,
  completedAt: null,
};
const legacyLikert = {
  ...legacyStandard,
  kind: 'likert',
  currentQuestionCode: 'm1',
  answers: [],
  questionPool: likertPool(),
};

const parse = (value: unknown) => v.safeParse(QuestionnaireArDef.state, value);

describe('QuestionnaireState — legacy-запись', () => {
  it.each([
    ['standard', legacyStandard],
    ['likert', legacyLikert],
  ] as const)(
    '%s: ISO → числа UTC, updatedAt = createdAt, version = 0',
    (kind, row) => {
      const res = parse(row);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.output.kind).toBe(kind);
        expect(res.output.createdAt).toBe(T);
        expect(res.output.updatedAt).toBe(T);
        expect(res.output.version).toBe(0);
        expect(res.output.completedAt).toBeNull();
      }
    },
  );

  it('даты ответов, warnedAt, continueInvitedAt и completedAt — числа', () => {
    const res = parse({
      ...legacyStandard,
      status: 'completed',
      updatedAt: '2026-06-01T11:00',
      warnedAt: '2026-06-01T10:20',
      continueInvitedAt: '2026-06-01T10:10',
      completedAt: '2026-06-01T11:00',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.answers[0]?.answeredAt).toBe(
        Date.UTC(2026, 5, 1, 10, 30),
      );
      expect(res.output.updatedAt).toBe(Date.UTC(2026, 5, 1, 11));
      expect(res.output.warnedAt).toBe(Date.UTC(2026, 5, 1, 10, 20));
      expect(res.output.continueInvitedAt).toBe(Date.UTC(2026, 5, 1, 10, 10));
      expect(res.output.completedAt).toBe(Date.UTC(2026, 5, 1, 11));
    }
  });
});

type Row = {
  title: string;
  value: unknown;
  valid?: boolean;
  output?: (out: QuestionnaireState) => void;
};

describe('QuestionnaireState — числовая запись и ветки kind', () => {
  it.each<Row>([
    {
      title: 'принимает числовую запись: даты и version как есть',
      value: { ...legacyStandard, createdAt: T, updatedAt: T + 5, version: 7 },
      valid: true,
      output: (out) => expect([out.updatedAt, out.version]).toEqual([T + 5, 7]),
    },
    {
      title: 'отклоняет likert-вопросы у standard',
      value: { ...legacyStandard, questionPool: likertPool() },
    },
    {
      title: 'отклоняет standard-вопросы у likert',
      value: { ...legacyLikert, questionPool: simplePool() },
    },
  ])('$title', ({ value, valid = false, output }) => {
    const res = parse(value);
    expect(res.success).toBe(valid);
    if (res.success) output?.(res.output);
  });
});

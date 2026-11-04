import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { AbandonWishErDef } from './abandon-wish.er';

const base = {
  questionnaireId: '11111111-1111-4111-8111-111111111111',
  respondentId: '22222222-2222-4222-8222-222222222222',
  kind: 'standard',
  ownerInfo: { courseId: '33333333-3333-4333-8333-333333333333' },
};
const [abandoned] = AbandonWishErDef.on;
const parses = (payload: unknown) =>
  v.safeParse(abandoned.payload, payload).success;

describe('AbandonWishErDef', () => {
  it('на прерывание анкеты меняет желания, событий не публикует, чужих модулей не вызывает', () => {
    expect(normalize(AbandonWishErDef)).toMatchObject({
      name: 'abandonWish',
      on: ['questionnaire.questionnaire.abandoned'],
      touches: ['wish'],
      calls: [],
      emits: [],
    });
  });

  // Контракт Q2/Т12: `ownerInfo`, `kind` и обязательная причина прерывания.
  it.each(['timeout', 'by_user', 'declined'])(
    'слушает событие с payload { ownerInfo, kind, reason: %s }',
    (reason) => {
      expect(parses({ ...base, reason })).toBe(true);
    },
  );

  it('прежнее поле owner и событие без reason не принимаются', () => {
    const { ownerInfo, ...noOwner } = base;
    expect(parses({ ...noOwner, owner: ownerInfo, reason: 'timeout' })).toBe(
      false,
    );
    expect(parses(base)).toBe(false);
  });
});

import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { ConfirmWishErDef } from './confirm-wish.er';

const ref = {
  questionnaireId: '11111111-1111-4111-8111-111111111111',
  respondentId: '22222222-2222-4222-8222-222222222222',
};
const [completed] = ConfirmWishErDef.on;
const parses = (payload: unknown) =>
  v.safeParse(completed.payload, payload).success;

describe('ConfirmWishErDef', () => {
  it('на завершение анкеты меняет желания, публикует confirmed, чужих модулей не вызывает', () => {
    expect(normalize(ConfirmWishErDef)).toMatchObject({
      name: 'confirmWish',
      on: ['questionnaire.questionnaire.completed'],
      touches: ['wish'],
      calls: [],
      emits: ['wish.wish.confirmed'],
    });
  });

  // Контракт Q2/Т12: данные владельца анкеты называются `ownerInfo`, вид — `kind`.
  it('слушает событие с payload { ownerInfo, kind }: прежнее поле owner не принимается', () => {
    const ownerInfo = { courseId: '33333333-3333-4333-8333-333333333333' };
    expect(parses({ ...ref, kind: 'standard', ownerInfo })).toBe(true);
    expect(parses({ ...ref, kind: 'standard', owner: ownerInfo })).toBe(false);
    expect(parses({ ...ref, ownerInfo })).toBe(false);
  });
});

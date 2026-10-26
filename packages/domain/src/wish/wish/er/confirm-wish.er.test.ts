import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import { ConfirmWishErDef } from './confirm-wish.er';

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
});

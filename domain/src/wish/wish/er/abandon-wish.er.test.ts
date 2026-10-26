import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import { AbandonWishErDef } from './abandon-wish.er';

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
});

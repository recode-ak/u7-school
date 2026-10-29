import { describe, expect, it } from 'bun:test';
import { allowAll } from 'dmg-core';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { ListScopeFactsUcDef } from './list-scope-facts.uc';

const ID = '11111111-1111-4111-8111-111111111111';

describe('ListScopeFactsUcDef', () => {
  it('query пользователя, allowAll, без ошибок', () => {
    expect(normalize(ListScopeFactsUcDef)).toMatchObject({
      name: 'listScopeFacts',
      type: 'query',
      aggregate: 'review',
      callers: ['user'],
      errors: [],
    });
    expect(ListScopeFactsUcDef.policy).toBe(allowAll);
  });

  it('вход — { scopeId } uuid', () => {
    const { input } = ListScopeFactsUcDef;
    expect(v.safeParse(input, { scopeId: ID }).success).toBe(true);
    expect(v.safeParse(input, { scopeId: 'x' }).success).toBe(false);
  });

  it('выход — { hasReviews, reviewsCount >= 0 целое }', () => {
    const { output } = ListScopeFactsUcDef;
    expect(v.parse(output, { hasReviews: true, reviewsCount: 2 })).toEqual({
      hasReviews: true,
      reviewsCount: 2,
    });
    expect(
      v.safeParse(output, { hasReviews: false, reviewsCount: -1 }).success,
    ).toBe(false);
    expect(
      v.safeParse(output, { hasReviews: false, reviewsCount: 0.5 }).success,
    ).toBe(false);
  });
});

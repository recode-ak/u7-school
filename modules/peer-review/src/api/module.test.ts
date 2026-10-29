import { describe, expect, test } from 'bun:test';
import type { PeerReviewApiModuleResolver } from '@u7-scl/domain/peer-review';
import { PeerReviewApiModule } from './module';

// Кампании (2 UC и ER из событий stream) переехали в Def-модуль:
// `../peer-review.module.test.ts`. Здесь — остаток legacy-модуля (рецензии).
describe('PeerReviewApiModule (ФР-7)', () => {
  test('пять UC рецензий + ER уведомления адресата', () => {
    const mod = new PeerReviewApiModule({} as PeerReviewApiModuleResolver);
    expect(mod.useCases.map((uc) => uc.getUcName()).sort()).toEqual([
      'create-review',
      'get-my-review',
      'list-my-reviews',
      'list-scope-facts',
      'list-scope-reviews',
    ]);
    expect(mod.reactions).toHaveLength(1);
    const eventNames = mod.reactions.flatMap((er) => [...er.getEventNames()]);
    expect(eventNames).toEqual(['review.created']);
  });
});

import { describe, expect, test } from 'bun:test';
import type { PeerReviewApiModuleResolver } from '@u7-scl/domain/peer-review';
import { PeerReviewApiModule } from './module';

// Все UC и реакции — в Def-модуле (`../peer-review.module.test.ts`); оболочка пуста до Ф3.
describe('PeerReviewApiModule (пустая оболочка до Ф3)', () => {
  test('нет UC, реакций и джоб', () => {
    const mod = new PeerReviewApiModule({} as PeerReviewApiModuleResolver);
    expect(mod.useCases).toEqual([]);
    expect(mod.reactions).toEqual([]);
    expect(mod.jobs).toEqual([]);
  });
});

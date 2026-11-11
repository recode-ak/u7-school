import { describe, expect, it } from 'bun:test';
import { ReviewRules } from '../review.rules';
import { CreateReviewUcDef } from './create-review.uc';

describe('CreateReviewUcDef', () => {
  it('правила по порядку: окно → адресат → текст', () => {
    expect(CreateReviewUcDef.rules).toEqual([
      ReviewRules.rules.windowOpen,
      ReviewRules.rules.recipientAllowed,
      ReviewRules.rules.validText,
    ]);
  });
});

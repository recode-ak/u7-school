import { describe, expect, test } from 'bun:test';
import { SensitiveMask } from 'dmg-core';
import { ReviewState, ReviewTextSchema } from './review.state';
import { ReviewSnapshotSchema } from './review.types';
import { CreateReviewUcDef } from './uc/create-review.uc';
import { GetMyReviewUcDef } from './uc/get-my-review.uc';

const mask = new SensitiveMask();

describe('peer-review: места с персональными данными помечены F.sensitive', () => {
  test.each([
    { place: 'state: text', schema: ReviewState, path: 'text' },
    {
      place: 'createReview: вход text',
      schema: CreateReviewUcDef.input,
      path: 'text',
    },
    {
      place: 'getMyReview: выход text',
      schema: GetMyReviewUcDef.output,
      path: 'text',
    },
    {
      place: 'ReviewSnapshotSchema.text',
      schema: ReviewSnapshotSchema,
      path: 'text',
    },
  ])('$place', ({ schema, path }) => {
    expect(mask.isSensitive(schema, path)).toBe(true);
  });

  test('ReviewTextSchema не помечена: пометка стоит на поле state', () => {
    expect(mask.containsSensitive(ReviewTextSchema)).toBe(false);
  });
});

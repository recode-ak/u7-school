import { EventDef, F } from 'dmg-core';
import * as v from 'valibot';
import {
  CampaignContextSchema,
  StudentOutcomeSchema,
} from '../shared/campaign-fields';

/**
 * События агрегата `review-campaign`.
 *
 * `created` — кампания отзывов создана (ФР-5): получатели приглашений UI —
 * субъект и ментор скоупа. Payload несёт полные данные (`mentorId`,
 * `subjectOutcome`); заголовок потока UI берёт сам.
 */
export const ReviewCampaignEvents = EventDef.define(
  'peer-review.review-campaign',
  {
    created: {
      label: 'Кампания отзывов создана',
      description:
        'Открыто окно сбора отзывов о судьбе студента потока; UI приглашает субъекта и ментора.',
      payload: v.object({
        campaignId: F.uuid('кампании отзывов'),
        context: CampaignContextSchema,
        scopeId: F.uuid('скоупа кампании'),
        subjectId: F.uuid('субъекта окна'),
        mentorId: F.uuid('ментора потока'),
        subjectOutcome: StudentOutcomeSchema,
      }),
    },
  },
);

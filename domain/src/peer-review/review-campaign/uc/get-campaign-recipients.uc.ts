import { F, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import {
  CampaignAuthorRoleSchema,
  CampaignContextSchema,
  StudentOutcomeSchema,
} from '../../shared/campaign-fields';
import { ReviewCampaignArDef } from '../review-campaign.ar';
import { ReviewCampaignErrors } from '../review-campaign.errors';
import { ReviewCampaignPolicy } from '../review-campaign.policy';

/**
 * Адресаты автора в окне: кому он может писать и о ком уже написал.
 * Policy — автор окна (`isWindowAuthor`); отсутствие кампании —
 * `NOT_FOUND` (отказ загрузки).
 */
export const GetCampaignRecipientsUcDef = UseCaseDef.define({
  name: 'getCampaignRecipients',
  label: 'Адресаты отзывов в кампании',
  description:
    'Адресаты отзывов автора в окне кампании с отметкой «мой отзыв уже есть», роль автора, ментор, исход субъекта и остаток окна.',
  type: 'query',
  aggregate: ReviewCampaignArDef,
  callers: ['user'],
  policy: ReviewCampaignPolicy.rules.isWindowAuthor,
  input: v.object({
    campaignId: F.uuid('кампании'),
  }),
  output: v.object({
    campaignId: F.uuid('кампании'),
    context: CampaignContextSchema,
    myRole: CampaignAuthorRoleSchema,
    mentorId: F.uuid('ментора потока'),
    subjectOutcome: StudentOutcomeSchema,
    daysLeft: v.pipe(
      v.number(),
      v.integer(),
      v.minValue(0),
      v.description('Остаток окна в днях (0 — окно закрыто)'),
    ),
    recipients: v.pipe(
      v.array(
        v.object({
          userId: F.uuid('адресата'),
          hasMyReview: F.boolean('мой отзыв адресату уже написан'),
        }),
      ),
      v.description('Адресаты автора в порядке показа'),
    ),
  }),
  errors: [ReviewCampaignErrors.NOT_FOUND],
});

/** Адресаты окна автора — для UI и внешних модулей. */
export type MyRecipientsView = OutputOf<typeof GetCampaignRecipientsUcDef>;

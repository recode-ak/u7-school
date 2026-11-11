import { allowAll, F, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import {
  CampaignAuthorRoleSchema,
  CampaignContextSchema,
  epochMsField,
  StudentOutcomeSchema,
} from '../../shared/campaign-fields';
import { ReviewCampaignArDef } from '../review-campaign.ar';

const count = (label: string) =>
  v.pipe(v.number(), v.integer(), v.minValue(0), v.description(label));

/** Карточка «моей кампании» для списка. */
const MyCampaignCard = v.object({
  campaignId: F.uuid('кампании'),
  context: CampaignContextSchema,
  scopeId: F.uuid('скоупа кампании'),
  subjectId: F.uuid('субъекта окна'),
  myRole: CampaignAuthorRoleSchema,
  expiresAt: epochMsField('закрытия окна'),
  subjectOutcome: StudentOutcomeSchema,
  daysLeft: count('Остаток окна в днях (0 — окно закрыто)'),
  progress: v.pipe(
    v.object({
      done: count('Мои отзывы в кампании'),
      total: count('Адресатов у меня по политике окна'),
    }),
    v.description('Прогресс отзывов: написано из положенных'),
  ),
});

/**
 * Мои кампании: где вызывающий — субъект окна или ментор потока. Только
 * свои — пользователь берётся из субъекта (в входе его нет), поэтому Policy
 * — `allowAll`. По умолчанию — только живые окна; `filter` сужает по
 * контексту и скоупу.
 */
export const GetMyCampaignsUcDef = UseCaseDef.define({
  name: 'getMyCampaigns',
  label: 'Мои кампании отзывов',
  description:
    'Живые кампании отзывов, где пользователь — субъект окна или ментор потока: роль, остаток окна и прогресс отзывов.',
  type: 'query',
  aggregate: ReviewCampaignArDef,
  callers: ['user'],
  policy: allowAll,
  input: v.object({
    filter: v.optional(
      v.pipe(
        v.object({
          context: v.optional(CampaignContextSchema),
          scopeId: v.optional(F.uuid('скоупа кампании')),
        }),
        v.description('Сужение выборки по контексту и скоупу'),
      ),
    ),
  }),
  output: v.array(MyCampaignCard),
  errors: [],
});

/** Карточка «моей кампании» — для UI и внешних модулей. */
export type MyCampaignCard = OutputOf<typeof GetMyCampaignsUcDef>[number];

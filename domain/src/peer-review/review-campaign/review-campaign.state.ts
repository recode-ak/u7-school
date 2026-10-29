import { BaseEntityFields, F } from 'dmg-core';
import * as v from 'valibot';
import { StudentOutcomeSchema } from '../shared/campaign-fields';

/** Специфика окна судьбы студента потока: исход субъекта и его ментор. */
export const StreamFatePayloadVo = v.object({
  subjectOutcome: StudentOutcomeSchema,
  mentorId: F.uuid('ментора потока — второго автора окна'),
});

export type StreamFatePayloadVo = v.InferOutput<typeof StreamFatePayloadVo>;

/**
 * Entity кампании отзывов контекста `stream_fate` — единственное место
 * структуры состояния. `subjectId` — студент, чьё событие открыло окно;
 * `participants` — только id адресуемых соучеников (без субъекта и ментора;
 * пустой список — адресат только ментор). Окно закрывается временем
 * (`expiresAt`), статус не хранится.
 */
export const ReviewCampaignState = v.object({
  ...BaseEntityFields,
  context: v.pipe(
    v.literal('stream_fate'),
    v.description('Контекст кампании: окно судьбы студента потока'),
  ),
  scopeId: F.uuid('скоупа кампании (для stream_fate — потока)'),
  subjectId: F.uuid('субъекта окна — студента, чьё событие открыло окно'),
  expiresAt: F.timestamp('закрытия окна сбора отзывов'),
  participants: v.pipe(
    v.array(F.uuid('адресуемого соученика')),
    v.description('Адресуемые соученики: без субъекта и ментора, без дублей'),
  ),
  payload: v.pipe(
    StreamFatePayloadVo,
    v.description('Специфика окна: исход субъекта и ментор'),
  ),
});

export type ReviewCampaignState = v.InferOutput<typeof ReviewCampaignState>;

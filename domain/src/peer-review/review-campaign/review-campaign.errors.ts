import { ErrorDef, F } from 'dmg-core';
import * as v from 'valibot';

const campaignId = F.uuid('кампании отзывов');

/**
 * Ошибки агрегата `review-campaign`, группа `REVIEW_CAMPAIGN` (ERR-04).
 * Ошибки рецензий (окно закрыто, не участник, адресат) — у `Review` (Ф2).
 */
export const ReviewCampaignErrors = ErrorDef.define('REVIEW_CAMPAIGN', {
  NOT_FOUND: {
    kind: 'not_found',
    label: 'Кампания отзывов не найдена',
    description: 'Кампании с таким идентификатором нет.',
    payload: v.object({ campaignId }),
  },
  ALREADY_EXISTS: {
    kind: 'conflict',
    label: 'Кампания отзывов уже создана',
    description:
      'На эту пару (скоуп, субъект) кампания уже есть: окно судьбы студента открывается один раз.',
    payload: v.object({
      scopeId: F.uuid('скоупа кампании'),
      subjectId: F.uuid('субъекта окна'),
    }),
  },
  INVALID_PARTICIPANTS: {
    kind: 'validation',
    label: 'Некорректный список адресуемых соучеников',
    description:
      'Участники кампании не уникальны, либо среди них субъект окна или ментор.',
    payload: v.object({
      reason: F.picklist(
        ['duplicate', 'subject', 'mentor'],
        'нарушенного условия: дубль, субъект или ментор среди участников',
      ),
      userId: F.uuid('нарушившего условие участника'),
    }),
  },
});

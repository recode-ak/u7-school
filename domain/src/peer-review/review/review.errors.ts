import { ErrorDef, F } from 'dmg-core';
import * as v from 'valibot';

const campaignId = F.uuid('кампании отзывов');

/**
 * Ошибки агрегата `review`, группа `REVIEW` (ERR-04). Отсутствие кампании —
 * `ReviewCampaignErrors.NOT_FOUND` (ссылкой, ERR-03); посторонний автор —
 * `ACCESS_DENIED` от Policy.
 */
export const ReviewErrors = ErrorDef.define('REVIEW', {
  WINDOW_CLOSED: {
    kind: 'conflict',
    label: 'Возможность оставлять отзывы закрыта: срок кампании истёк',
    description:
      'Окно кампании закрыто: писать и перезаписывать отзывы уже нельзя.',
    payload: v.object({
      campaignId,
      expiresAt: v.pipe(
        v.number(),
        v.integer(),
        v.description('Время закрытия окна (мс, UTC)'),
      ),
    }),
  },
  RECIPIENT_NOT_ALLOWED: {
    kind: 'conflict',
    label: 'Адресат недоступен по политике для роли автора',
    description: 'Адресат вне списка допустимых для роли автора в этом окне.',
    payload: v.object({
      campaignId,
      authorId: F.uuid('автора отзыва'),
      recipientId: F.uuid('адресата отзыва'),
    }),
  },
  TEXT_INVALID: {
    kind: 'validation',
    label: 'Текст отзыва должен быть от 10 до 3500 символов',
    description: 'Длина текста отзыва вне допустимых границ.',
    payload: v.object({
      min: F.int('минимальной длины текста'),
      max: F.int('максимальной длины текста'),
      length: F.int('фактической длины текста'),
    }),
  },
});

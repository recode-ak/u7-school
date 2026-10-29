import {
  GetStreamMembersUcDef,
  StudentEvents,
} from '@u7-scl/domain/stream/contract';
import { EventReactionDef } from 'dmg-core';
import { ReviewCampaignArDef } from '../review-campaign.ar';
import { ReviewCampaignEvents } from '../review-campaign.events';

/**
 * Создание кампании по судьбе студента: событие `student.completed` или
 * `student.abandoned` потока открывает окно отзывов. Проекцию исхода и
 * адресатов строит `StudentFateDqs`, уникальность пары — `ReviewCampaignRules`,
 * кампанию — `ReviewCampaignAr.create`. Кампания пары уже есть — успех без
 * записи; состав потока недоступен — предупреждение и выход без кампании.
 */
export const CreateStudentCampaignErDef = EventReactionDef.define({
  name: 'createStudentCampaign',
  label: 'Создать кампанию по судьбе студента',
  description:
    'Когда студент завершил модуль потока или ушёл с него, открывается окно отзывов о его судьбе для него самого и ментора; повтор для той же пары (поток, студент) кампанию не создаёт.',
  on: [StudentEvents.completed, StudentEvents.abandoned],
  touches: [ReviewCampaignArDef],
  calls: [GetStreamMembersUcDef],
  emits: [ReviewCampaignEvents.created],
});

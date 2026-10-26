import { QuestionnaireEvents } from '@u7-scl/domain/questionnaire/contract';
import { defineEventReaction } from 'dmg-core';
import { WishArDef } from '../wish.ar';

/**
 * Пометка желания брошенным по прерыванию анкеты. Выбор желания и
 * допустимость перехода решает `WishAr`; чужие анкеты игнорируются.
 */
export const AbandonWishErDef = defineEventReaction({
  name: 'abandonWish',
  label: 'Пометить желание брошенным по прерыванию анкеты',
  description:
    'Когда анкета курса прервана (таймаут или решение пользователя), его ожидающее анкету желание на этот курс становится брошенным; остальные желания и чужие анкеты не затрагиваются.',
  on: [QuestionnaireEvents.abandoned],
  touches: [WishArDef],
  calls: [],
  emits: [],
});

import { QuestionnaireEvents } from '@u7-scl/domain/questionnaire/contract';
import { EventReactionDef } from 'dmg-core';
import { WishArDef } from '../wish.ar';
import { WishEvents } from '../wish.events';

/**
 * Подтверждение желания по завершении анкеты. Чьё это желание и что делать
 * с ним — решает `WishAr` (`questionnaireTarget`, `current`, `canConfirm`);
 * чужие анкеты (`owner` не в формате `wish`) игнорируются.
 */
export const ConfirmWishErDef = EventReactionDef.define({
  name: 'confirmWish',
  label: 'Подтвердить желание по завершении анкеты',
  description:
    'Когда пользователь завершил анкету курса, его ожидающее анкету желание на этот курс становится подтверждённым; остальные желания и чужие анкеты не затрагиваются.',
  on: [QuestionnaireEvents.completed],
  touches: [WishArDef],
  calls: [],
  emits: [WishEvents.confirmed],
});

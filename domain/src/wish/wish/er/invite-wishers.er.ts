import {
  GetCoursesStartingWithModuleUcDef,
  GetSameModulesUcDef,
} from '@u7-scl/domain/course/contract';
import {
  GetStreamPresenceUcDef,
  StreamEvents,
} from '@u7-scl/domain/stream/contract';
import { GetTelegramAddressesUcDef } from '@u7-scl/domain/user/contract';
import { EventReactionDef } from 'dmg-core';
import { WishArDef } from '../wish.ar';
import { WishEvents } from '../wish.events';

/**
 * Приглашение желающих при открытии набора. Что спросить у курсов, потоков
 * и пользователей и каких желающих пригласить, решает `WishInvitationDcs`;
 * событие приглашения строит `WishAr.invite`.
 */
export const InviteWishersErDef = EventReactionDef.define({
  name: 'inviteWishers',
  label: 'Пригласить желающих при открытии набора',
  description:
    'Когда создан поток, желающие пройти его курс (если модуль стартовый) или сам модуль получают приглашение на поток; без telegramId приглашение пропускается с предупреждением.',
  on: [StreamEvents.created],
  touches: [WishArDef],
  calls: [
    GetCoursesStartingWithModuleUcDef,
    GetSameModulesUcDef,
    GetStreamPresenceUcDef,
    GetTelegramAddressesUcDef,
  ],
  emits: [WishEvents.invited],
});

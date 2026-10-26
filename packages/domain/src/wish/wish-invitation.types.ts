import type {
  GetCoursesStartingWithModuleUcDef,
  GetSameModulesUcDef,
} from '@u7-scl/domain/course/contract';
import type { GetStreamPresenceUcDef } from '@u7-scl/domain/stream/contract';
import type { GetTelegramAddressesUcDef } from '@u7-scl/domain/user/contract';
import type { InputOf, OutputOf } from 'dmg-core';
import type { WishAr } from './wish/wish.ar';

/**
 * Раунд 1: вопросы к модулю курсов — готовые входы его UC. Вопроса нет,
 * если спрашивать не о чем: вызывающий не обращается к курсу.
 */
export type InvitationMatchQuestion = {
  readonly courses?: InputOf<typeof GetCoursesStartingWithModuleUcDef>;
  readonly modules?: InputOf<typeof GetSameModulesUcDef>;
};

/** Ответы курсов на `InvitationMatchQuestion`: на заданные вопросы. */
export type InvitationMatchAnswer = {
  readonly courses?: OutputOf<typeof GetCoursesStartingWithModuleUcDef>;
  readonly modules?: OutputOf<typeof GetSameModulesUcDef>;
};

/**
 * Раунд 2: вопросы о потоке и адресах — готовые входы UC потоков и
 * пользователей. Задаются вместе и только если есть совпавшие желания.
 */
export type InvitationReachQuestion = {
  readonly stream?: InputOf<typeof GetStreamPresenceUcDef>;
  readonly addresses?: InputOf<typeof GetTelegramAddressesUcDef>;
};

/** Ответы потоков и пользователей на `InvitationReachQuestion`. */
export type InvitationReachAnswer = {
  readonly stream?: OutputOf<typeof GetStreamPresenceUcDef>;
  readonly addresses?: OutputOf<typeof GetTelegramAddressesUcDef>;
};

/**
 * Итог приглашения: приглашённые желания (их регистрирует вызывающий) и
 * пользователи без адреса — для предупреждения в логе.
 */
export type InvitationOutcome = {
  readonly invited: readonly WishAr[];
  readonly unreachable: readonly string[];
};

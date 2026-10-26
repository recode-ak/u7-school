import { WishModuleDef } from '@u7-scl/domain/wish';
import type { Identified } from 'dmg-core';
import { type ModuleDeps, ModuleFromDef, type ModuleMap } from 'dmg-core/app';
import { AbandonWishEr } from './wish/er/abandon-wish.er';
import { ConfirmWishEr } from './wish/er/confirm-wish.er';
import { FulfillWishEr } from './wish/er/fulfill-wish.er';
import { InviteWishersEr } from './wish/er/invite-wishers.er';
import { CancelWishUc } from './wish/uc/cancel-wish.uc';
import { CreateCourseWishUc } from './wish/uc/create-course-wish.uc';
import { CreateModuleWishUc } from './wish/uc/create-module-wish.uc';
import { ListUserWishesUc } from './wish/uc/list-user-wishes.uc';
import type { WishRepo } from './wish/wish.repo';
// gen:defs:imports

/**
 * Резолвер модуля: платформа, фасады зависимостей (`facades` — курсы и
 * анкеты из `dependsOn`; вызываемые UC — в `calls` операций, D-43) и
 * репозиторий желаний.
 */
export type WishDeps = ModuleDeps & {
  readonly wishes: WishRepo;
  // gen:deps
};

/** Карта «Def → класс» модуля wish (API-05). */
export const wishMap = {
  useCases: {
    createCourseWish: CreateCourseWishUc,
    createModuleWish: CreateModuleWishUc,
    cancelWish: CancelWishUc,
    listUserWishes: ListUserWishesUc,
    // gen:defs:useCases
  },
  reactions: {
    fulfillWish: FulfillWishEr,
    confirmWish: ConfirmWishEr,
    abandonWish: AbandonWishEr,
    inviteWishers: InviteWishersEr,
    // gen:defs:reactions
  },
  jobs: {
    // gen:defs:jobs
  },
} satisfies ModuleMap<typeof WishModuleDef, WishDeps, Identified>;

/** Модуль wish с зависимостями — для сборки приложения. */
export function createWishModule(deps: WishDeps) {
  return new ModuleFromDef<typeof WishModuleDef, WishDeps, Identified>(
    WishModuleDef,
    wishMap,
    deps,
  );
}

// DEBT-21, DEBT-22: субъект модуля — legacy `User` (`@u7-scl/app`).
import type { User } from '@u7-scl/app/domain';
import { WishModuleDef } from '@u7-scl/domain/wish';
import { type ModuleDeps, ModuleFromDef, type ModuleMap } from 'dmg-core/app';
import { CancelWishUc } from './wish/uc/cancel-wish.uc';
import { CreateCourseWishUc } from './wish/uc/create-course-wish.uc';
import { CreateModuleWishUc } from './wish/uc/create-module-wish.uc';
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
    // gen:defs:useCases
  },
  reactions: {
    // gen:defs:reactions
  },
  jobs: {
    // gen:defs:jobs
  },
} satisfies ModuleMap<typeof WishModuleDef, WishDeps, User>;

/** Модуль wish с зависимостями — для сборки приложения. */
export function createWishModule(deps: WishDeps) {
  return new ModuleFromDef<typeof WishModuleDef, WishDeps, User>(
    WishModuleDef,
    wishMap,
    deps,
  );
}

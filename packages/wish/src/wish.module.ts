// DEBT-21, DEBT-22: субъект модуля — legacy `User` (`@u7-scl/app`).
import type { User } from '@u7-scl/app/domain';
import type { CourseModuleFacade } from '@u7-scl/domain/course/contract';
import type { QuestionnaireModuleFacade } from '@u7-scl/domain/questionnaire/contract';
import { WishModuleDef } from '@u7-scl/domain/wish';
import { type ModuleDeps, ModuleFromDef, type ModuleMap } from 'dmg-core/app';
import { CreateCourseWishUc } from './wish/uc/create-course-wish.uc';
import type { WishRepo } from './wish/wish.repo';
// gen:defs:imports

/**
 * Резолвер модуля: платформа, репозиторий желаний и фасады зависимостей
 * по D-42 (`dependsOn`; вызываемые UC — в `calls` операций).
 */
export type WishDeps = ModuleDeps & {
  readonly wishes: WishRepo;
  readonly course: CourseModuleFacade;
  readonly questionnaire: QuestionnaireModuleFacade;
  // gen:deps
};

/** Карта «Def → класс» модуля wish (API-05). */
export const wishMap = {
  useCases: {
    createCourseWish: CreateCourseWishUc,
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

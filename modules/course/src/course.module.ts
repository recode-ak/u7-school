// DMG-модуль внешнего контракта курсов: адаптеры над legacy-фасадом и UC модуля.
import type { CourseFacade } from '@u7-scl/domain/course';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import type { User } from '@u7-scl/domain/user/contract';
import { type ModuleDeps, ModuleFromDef, type ModuleMap } from 'dmg-core/app';
import { GetCourseEnrollmentUc } from './course/uc/get-course-enrollment.uc';
import { GetCoursesIncludingModuleUc } from './course/uc/get-courses-including-module.uc';
import { GetCoursesStartingWithModuleUc } from './course/uc/get-courses-starting-with-module.uc';
import { GetModuleEnrollmentUc } from './course/uc/get-module-enrollment.uc';
import { GetModulePrerequisiteUc } from './course/uc/get-module-prerequisite.uc';
import { GetModuleSnapshotUc } from './course/uc/get-module-snapshot.uc';
import { GetSameModulesUc } from './course/uc/get-same-modules.uc';
import type { ModuleRepo } from './module/module.repo';
import { GetModuleUc } from './module/uc/get-module.uc';
import { ListModulesUc } from './module/uc/list-modules.uc';

/**
 * Что адаптеры над legacy-фасадом берут у legacy-фасада курсов: только вопросы,
 * нужные UC внешнего контракта.
 */
export type CourseLegacy = Pick<
  CourseFacade,
  | 'isCourseEnrollable'
  | 'getCourseStartModuleId'
  | 'getModulePlace'
  | 'whichCoursesIncludeModule'
  | 'whichModulesAreSame'
  | 'getModuleSnapshot'
  | 'getCourseByModuleId'
  | 'getModule'
>;

/** Субъект курсов: права зависят только от `uuid` и ролей (`ModulePolicy`). */
export type CourseUser = Pick<User, 'uuid' | 'roles'>;

/**
 * Резолвер DMG-модуля курсов: платформа, legacy-фасад (адаптеры внешнего
 * контракта) и репозиторий модулей (срез `module`).
 */
export type CourseModuleDeps = ModuleDeps & {
  readonly legacy: CourseLegacy;
  readonly modules: ModuleRepo;
};

/**
 * Карта «Def → класс» внешнего модуля курсов (API-05, D-37): адаптеры над
 * legacy и UC среза `module`; ER и Job у модуля нет.
 */
export const courseModuleMap = {
  useCases: {
    getCourseEnrollment: GetCourseEnrollmentUc,
    getModuleEnrollment: GetModuleEnrollmentUc,
    getCoursesIncludingModule: GetCoursesIncludingModuleUc,
    getCoursesStartingWithModule: GetCoursesStartingWithModuleUc,
    getSameModules: GetSameModulesUc,
    getModuleSnapshot: GetModuleSnapshotUc,
    getModulePrerequisite: GetModulePrerequisiteUc,
    getModule: GetModuleUc,
    listModules: ListModulesUc,
  },
  reactions: {},
  jobs: {},
} satisfies ModuleMap<typeof CourseModuleDef, CourseModuleDeps, CourseUser>;

/**
 * DMG-модуль курсов — владелец UC внешнего контракта; фасад для других
 * модулей — `new ModuleFacade(createCourseModule(deps))` (D-43). Приложение
 * собирает его поверх legacy `CourseInProcFacade` и репозитория модулей.
 */
export function createCourseModule(deps: CourseModuleDeps) {
  return new ModuleFromDef<
    typeof CourseModuleDef,
    CourseModuleDeps,
    CourseUser
  >(CourseModuleDef, courseModuleMap, deps);
}

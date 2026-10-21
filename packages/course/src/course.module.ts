// TR-11: DMG-модуль внешнего контракта курсов — адаптеры над legacy-фасадом.
import type { CourseFacade } from '@u7-scl/domain/course';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import type { Identified } from 'dmg-core';
import { type ModuleDeps, ModuleFromDef, type ModuleMap } from 'dmg-core/app';
import { GetCourseEnrollmentUc } from './course/uc/get-course-enrollment.uc';

/**
 * Что адаптеры TR-11 берут у legacy-фасада курсов: только вопросы,
 * нужные UC внешнего контракта.
 */
export type CourseLegacy = Pick<
  CourseFacade,
  'isCourseEnrollable' | 'getCourseStartModuleId'
>;

/**
 * Резолвер DMG-модуля курсов: платформа + legacy-фасад (TR-11). Своих
 * репозиториев нет — данные читает legacy-модуль.
 */
export type CourseModuleDeps = ModuleDeps & { readonly legacy: CourseLegacy };

/**
 * Карта «Def → класс» внешнего модуля курсов (API-05, D-37): реализации —
 * адаптеры над legacy (TR-11); ER и Job у внешнего модуля нет.
 */
export const courseModuleMap = {
  useCases: { getCourseEnrollment: GetCourseEnrollmentUc },
  reactions: {},
  jobs: {},
} satisfies ModuleMap<typeof CourseModuleDef, CourseModuleDeps, Identified>;

/**
 * DMG-модуль курсов — владелец UC внешнего контракта (`UseCaseOwner`) для
 * фасада `courseModuleFacade`. Приложение собирает его поверх legacy
 * `CourseInProcFacade` (TR-11).
 */
export function createCourseModule(deps: CourseModuleDeps) {
  return new ModuleFromDef<
    typeof CourseModuleDef,
    CourseModuleDeps,
    Identified
  >(CourseModuleDef, courseModuleMap, deps);
}

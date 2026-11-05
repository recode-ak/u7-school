// DMG-модуль курсов: UC чтения курсов и срезов `module`, `lesson`, `step`.
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import type { User } from '@u7-scl/domain/user/contract';
import { type ModuleDeps, ModuleFromDef, type ModuleMap } from 'dmg-core/app';
import type { CourseRepo } from './course/course.repo';
import { GetCourseUc } from './course/uc/get-course.uc';
import { GetCourseByModuleUc } from './course/uc/get-course-by-module.uc';
import { GetCourseEnrollmentUc } from './course/uc/get-course-enrollment.uc';
import { GetCoursesIncludingModuleUc } from './course/uc/get-courses-including-module.uc';
import { GetCoursesStartingWithModuleUc } from './course/uc/get-courses-starting-with-module.uc';
import { GetModuleEnrollmentUc } from './course/uc/get-module-enrollment.uc';
import { GetModulePlaceUc } from './course/uc/get-module-place.uc';
import { GetModulePrerequisiteUc } from './course/uc/get-module-prerequisite.uc';
import { GetSameModulesUc } from './course/uc/get-same-modules.uc';
import { ListCoursesUc } from './course/uc/list-courses.uc';
import type { LessonRepo } from './lesson/lesson.repo';
import { GetLessonUc } from './lesson/uc/get-lesson.uc';
import type { ModuleRepo } from './module/module.repo';
import { GetModuleUc } from './module/uc/get-module.uc';
import { GetModuleSnapshotUc } from './module/uc/get-module-snapshot.uc';
import { ListModulesUc } from './module/uc/list-modules.uc';
import type { StepRepo } from './step/step.repo';
import { GetStepUc } from './step/uc/get-step.uc';
import { GetStepsByLessonsUc } from './step/uc/get-steps-by-lessons.uc';

/** Субъект курсов: права зависят только от `uuid` и ролей (`ModulePolicy`). */
export type CourseUser = Pick<User, 'uuid' | 'roles'>;

/**
 * Резолвер DMG-модуля курсов: платформа и репозитории срезов `course`,
 * `module`, `lesson` и `step`.
 */
export type CourseModuleDeps = ModuleDeps & {
  readonly courses: CourseRepo;
  readonly modules: ModuleRepo;
  readonly lessons: LessonRepo;
  readonly steps: StepRepo;
};

/**
 * Карта «Def → класс» внешнего модуля курсов (API-05, D-37): UC чтения курсов
 * и UC срезов; ER и Job у модуля нет.
 */
export const courseModuleMap = {
  useCases: {
    getCourse: GetCourseUc,
    listCourses: ListCoursesUc,
    getCourseByModule: GetCourseByModuleUc,
    getModulePlace: GetModulePlaceUc,
    getCourseEnrollment: GetCourseEnrollmentUc,
    getModuleEnrollment: GetModuleEnrollmentUc,
    getCoursesIncludingModule: GetCoursesIncludingModuleUc,
    getCoursesStartingWithModule: GetCoursesStartingWithModuleUc,
    getSameModules: GetSameModulesUc,
    getModuleSnapshot: GetModuleSnapshotUc,
    getModulePrerequisite: GetModulePrerequisiteUc,
    getModule: GetModuleUc,
    listModules: ListModulesUc,
    getLesson: GetLessonUc,
    getStep: GetStepUc,
    getStepsByLessons: GetStepsByLessonsUc,
  },
  reactions: {},
  jobs: {},
} satisfies ModuleMap<typeof CourseModuleDef, CourseModuleDeps, CourseUser>;

/**
 * DMG-модуль курсов — владелец UC внешнего контракта; фасад для других
 * модулей — `new ModuleFacade(createCourseModule(deps))` (D-43).
 */
export function createCourseModule(deps: CourseModuleDeps) {
  return new ModuleFromDef<
    typeof CourseModuleDef,
    CourseModuleDeps,
    CourseUser
  >(CourseModuleDef, courseModuleMap, deps);
}

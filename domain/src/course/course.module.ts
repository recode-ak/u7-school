import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { ModuleDef } from 'dmg-core';
import { CourseArDef } from './course/course.ar';
import { GetCourseEnrollmentUcDef } from './course/uc/get-course-enrollment.uc';
import { GetCoursesIncludingModuleUcDef } from './course/uc/get-courses-including-module.uc';
import { GetCoursesStartingWithModuleUcDef } from './course/uc/get-courses-starting-with-module.uc';
import { GetModuleEnrollmentUcDef } from './course/uc/get-module-enrollment.uc';
import { GetModulePrerequisiteUcDef } from './course/uc/get-module-prerequisite.uc';
import { GetSameModulesUcDef } from './course/uc/get-same-modules.uc';
import { LessonArDef } from './lesson/lesson.ar';
import { GetLessonUcDef } from './lesson/uc/get-lesson.uc';
import { ModuleArDef } from './module/module.ar';
import { GetModuleUcDef } from './module/uc/get-module.uc';
import { GetModuleSnapshotUcDef } from './module/uc/get-module-snapshot.uc';
import { ListModulesUcDef } from './module/uc/list-modules.uc';
import { StepArDef } from './step/step.ar';
import { GetStepUcDef } from './step/uc/get-step.uc';
import { GetStepsByLessonsUcDef } from './step/uc/get-steps-by-lessons.uc';

/**
 * Внешний модуль курсов (D-37): реализован legacy-кодом, здесь только
 * контракт для `dependsOn` и Def UC без реализации, которые вызывают другие
 * модули (D-42; исполняет адаптер над legacy-фасадом). При миграции
 * `external` снимается.
 */
export const CourseModuleDef = ModuleDef.define({
  name: 'course',
  label: 'Курсы',
  description: 'Курсы, модули, уроки и шаги учебного контента.',
  external: true,
  dependsOn: [UserModuleDef],
  aggregates: [CourseArDef, ModuleArDef, LessonArDef, StepArDef],
  useCases: [
    GetCourseEnrollmentUcDef,
    GetModuleEnrollmentUcDef,
    GetCoursesIncludingModuleUcDef,
    GetSameModulesUcDef,
    GetCoursesStartingWithModuleUcDef,
    GetModuleSnapshotUcDef,
    GetModulePrerequisiteUcDef,
    GetModuleUcDef,
    ListModulesUcDef,
    GetLessonUcDef,
    GetStepUcDef,
    GetStepsByLessonsUcDef,
  ],
  reactions: [],
  jobs: [],
});

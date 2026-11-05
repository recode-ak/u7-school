import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { ModuleDef } from 'dmg-core';
import { CourseArDef } from './course/course.ar';
import { GetCourseEnrollmentUcDef } from './course/uc/get-course-enrollment.uc';
import { GetCoursesIncludingModuleUcDef } from './course/uc/get-courses-including-module.uc';
import { GetCoursesStartingWithModuleUcDef } from './course/uc/get-courses-starting-with-module.uc';
import { GetModuleEnrollmentUcDef } from './course/uc/get-module-enrollment.uc';
import { GetModulePrerequisiteUcDef } from './course/uc/get-module-prerequisite.uc';
import { GetModuleSnapshotUcDef } from './course/uc/get-module-snapshot.uc';
import { GetSameModulesUcDef } from './course/uc/get-same-modules.uc';
import { ModuleArDef } from './module/module.ar';
import { GetModuleUcDef } from './module/uc/get-module.uc';
import { ListModulesUcDef } from './module/uc/list-modules.uc';

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
  aggregates: [CourseArDef, ModuleArDef],
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
  ],
  reactions: [],
  jobs: [],
});

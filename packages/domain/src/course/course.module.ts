import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { defineModule } from 'dmg-core';
import { CourseArDef } from './course/course.ar';
import { GetCourseEnrollmentUcDef } from './course/uc/get-course-enrollment.uc';
import { GetModuleEnrollmentUcDef } from './course/uc/get-module-enrollment.uc';

/**
 * Внешний модуль курсов (D-37): реализован legacy-кодом, здесь только
 * контракт для `dependsOn` и Def UC без реализации, которые вызывают другие
 * модули (D-42; исполняет адаптер над legacy-фасадом, TR-11). При миграции
 * `external` снимается.
 */
export const CourseModuleDef = defineModule({
  name: 'course',
  label: 'Курсы',
  description: 'Курсы, модули, уроки и шаги учебного контента.',
  external: true,
  dependsOn: [UserModuleDef],
  aggregates: [CourseArDef],
  useCases: [GetCourseEnrollmentUcDef, GetModuleEnrollmentUcDef],
  reactions: [],
  jobs: [],
});

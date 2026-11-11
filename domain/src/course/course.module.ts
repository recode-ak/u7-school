import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { ModuleDef } from 'dmg-core';
import { CourseArDef } from './course/course.ar';
import { GetCourseUcDef } from './course/uc/get-course.uc';
import { GetCourseByModuleUcDef } from './course/uc/get-course-by-module.uc';
import { GetCourseEnrollmentUcDef } from './course/uc/get-course-enrollment.uc';
import { GetCoursesIncludingModuleUcDef } from './course/uc/get-courses-including-module.uc';
import { GetCoursesStartingWithModuleUcDef } from './course/uc/get-courses-starting-with-module.uc';
import { GetModuleEnrollmentUcDef } from './course/uc/get-module-enrollment.uc';
import { GetModulePlaceUcDef } from './course/uc/get-module-place.uc';
import { GetModulePrerequisiteUcDef } from './course/uc/get-module-prerequisite.uc';
import { GetSameModulesUcDef } from './course/uc/get-same-modules.uc';
import { ListCoursesUcDef } from './course/uc/list-courses.uc';
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
 * Паспорт модуля курсов: четыре агрегата (курс, модуль, урок, шаг) и UC чтения
 * курсов и срезов; ER и Job у модуля нет.
 */
export const CourseModuleDef = ModuleDef.define({
  name: 'course',
  label: 'Курсы',
  description: 'Курсы, модули, уроки и шаги учебного контента.',
  dependsOn: [UserModuleDef],
  aggregates: [CourseArDef, ModuleArDef, LessonArDef, StepArDef],
  useCases: [
    GetCourseUcDef,
    ListCoursesUcDef,
    GetCourseByModuleUcDef,
    GetModulePlaceUcDef,
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

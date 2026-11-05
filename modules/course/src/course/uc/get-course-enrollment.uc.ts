import type { CourseAr } from '@u7-scl/domain/course';
import {
  type CourseEnrollment,
  type CourseModuleDef,
  GetCourseEnrollmentUcDef,
} from '@u7-scl/domain/course/contract';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps } from '../../course.module';

type Loaded = { readonly course: CourseAr | undefined };
type Input = ParsedInputOf<typeof GetCourseEnrollmentUcDef>;

/**
 * Запись на курс — для других модулей: стартовый модуль программы. Курс не
 * найден, не опубликован или без программы — для записи неотличимы:
 * `enrollable: false`, без причины.
 */
export class GetCourseEnrollmentUc extends UseCaseFromDef<
  typeof GetCourseEnrollmentUcDef,
  CourseModuleDeps,
  Loaded
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetCourseEnrollmentUcDef, deps, module);
  }

  protected async load({ courseId }: Input) {
    return ok({ course: await this.resolve.courses.findById(courseId) });
  }

  protected async execute(_: Input, { course }: Loaded) {
    const startModuleId = course?.enrollmentStart();
    return startModuleId === undefined
      ? ok<CourseEnrollment>({ enrollable: false })
      : ok<CourseEnrollment>({ enrollable: true, startModuleId });
  }
}

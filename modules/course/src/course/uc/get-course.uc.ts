import { type CourseAr, CourseErrors } from '@u7-scl/domain/course';
import {
  type CourseModuleDef,
  GetCourseUcDef,
} from '@u7-scl/domain/course/contract';
import { err, ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps, CourseUser } from '../../course.module';

type Loaded = { readonly course: CourseAr };
type Input = ParsedInputOf<typeof GetCourseUcDef>;

/**
 * Курс по идентификатору: чтение открыто всем, статус курс не скрывает —
 * представление курса отдаётся как есть.
 */
export class GetCourseUc extends UseCaseFromDef<
  typeof GetCourseUcDef,
  CourseModuleDeps,
  Loaded,
  CourseUser
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetCourseUcDef, deps, module);
  }

  protected async load({ courseId }: Input) {
    const course = await this.resolve.courses.findById(courseId);
    return course
      ? ok({ course })
      : err(CourseErrors.NOT_FOUND.make({ courseId }));
  }

  protected async execute(_: Input, { course }: Loaded) {
    return ok(course.view());
  }
}

import { type CourseAr, ModuleCoursesDqs } from '@u7-scl/domain/course';
import {
  type CourseModuleDef,
  GetModuleEnrollmentUcDef,
} from '@u7-scl/domain/course/contract';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps } from '../../course.module';

type Loaded = { readonly courses: readonly CourseAr[] };
type Input = ParsedInputOf<typeof GetModuleEnrollmentUcDef>;

/**
 * Запись на модуль — для других модулей: входит ли модуль в программу хотя бы
 * одного опубликованного курса. Правило выбора курса модуля —
 * `ModuleCoursesDqs`.
 */
export class GetModuleEnrollmentUc extends UseCaseFromDef<
  typeof GetModuleEnrollmentUcDef,
  CourseModuleDeps,
  Loaded
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetModuleEnrollmentUcDef, deps, module);
  }

  protected async load() {
    return ok({
      courses: await this.resolve.courses.findAll({ status: 'published' }),
    });
  }

  protected async execute({ moduleId }: Input, { courses }: Loaded) {
    const course = new ModuleCoursesDqs(courses).firstPublishedIncluding(
      moduleId,
    );
    return ok({ enrollable: course !== undefined });
  }
}

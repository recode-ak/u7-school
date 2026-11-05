import { type CourseAr, ModuleCoursesDqs } from '@u7-scl/domain/course';
import {
  type CourseModuleDef,
  GetCourseByModuleUcDef,
} from '@u7-scl/domain/course/contract';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps, CourseUser } from '../../course.module';

type Loaded = { readonly courses: readonly CourseAr[] };
type Input = ParsedInputOf<typeof GetCourseByModuleUcDef>;

/**
 * Курс, в программу которого входит модуль: любого статуса, первый в порядке
 * файла. Правило выбора курса модуля — `ModuleCoursesDqs`; модуль вне курсов
 * — пусто, а не ошибка.
 */
export class GetCourseByModuleUc extends UseCaseFromDef<
  typeof GetCourseByModuleUcDef,
  CourseModuleDeps,
  Loaded,
  CourseUser
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetCourseByModuleUcDef, deps, module);
  }

  protected async load() {
    return ok({ courses: await this.resolve.courses.findAll() });
  }

  protected async execute({ moduleId }: Input, { courses }: Loaded) {
    const course = new ModuleCoursesDqs(courses).firstIncluding(moduleId);
    return ok(course?.view());
  }
}

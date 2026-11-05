import {
  type CourseModuleDef,
  ListCoursesUcDef,
} from '@u7-scl/domain/course/contract';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps, CourseUser } from '../../course.module';

type Input = ParsedInputOf<typeof ListCoursesUcDef>;

/**
 * Курсы для показа: без `status` — только опубликованные (как в v0.2.6).
 * Выборку, сортировку и `limit` делает репозиторий; в ответе — представление
 * курса со `stages` (по ним строится навигация).
 */
export class ListCoursesUc extends UseCaseFromDef<
  typeof ListCoursesUcDef,
  CourseModuleDeps,
  undefined,
  CourseUser
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(ListCoursesUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute(filter: Input) {
    const courses = await this.resolve.courses.findAll({
      ...filter,
      status: filter.status ?? 'published',
    });
    return ok(courses.map((course) => course.view()));
  }
}

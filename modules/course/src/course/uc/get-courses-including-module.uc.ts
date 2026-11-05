import type { CourseAr } from '@u7-scl/domain/course';
import {
  type CourseModuleDef,
  GetCoursesIncludingModuleUcDef,
} from '@u7-scl/domain/course/contract';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps } from '../../course.module';

type Loaded = { readonly courses: readonly CourseAr[] };
type Input = ParsedInputOf<typeof GetCoursesIncludingModuleUcDef>;

/**
 * Какие из переданных курсов включают модуль — для других модулей: курс в
 * любом статусе (принадлежность в т.ч. историческая), неизвестный
 * пропускается, порядок ответа — порядок `courseIds`.
 */
export class GetCoursesIncludingModuleUc extends UseCaseFromDef<
  typeof GetCoursesIncludingModuleUcDef,
  CourseModuleDeps,
  Loaded
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetCoursesIncludingModuleUcDef, deps, module);
  }

  protected async load({ courseIds }: Input) {
    if (courseIds.length === 0) return ok({ courses: [] });
    return ok({ courses: await this.resolve.courses.findByIds(courseIds) });
  }

  protected async execute({ moduleId, courseIds }: Input, { courses }: Loaded) {
    const byId = new Map(courses.map((course) => [course.uuid, course]));
    const included = courseIds.flatMap((courseId) => {
      const course = byId.get(courseId);
      return course?.includesModule(moduleId) ? [course.uuid] : [];
    });
    return ok({ courseIds: included });
  }
}

import { type CourseAr, ModuleCoursesDqs } from '@u7-scl/domain/course';
import {
  type CourseModuleDef,
  GetCoursesStartingWithModuleUcDef,
} from '@u7-scl/domain/course/contract';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps } from '../../course.module';

type Loaded = { readonly courses: readonly CourseAr[] };
type Input = ParsedInputOf<typeof GetCoursesStartingWithModuleUcDef>;

/**
 * Какие из переданных курсов начинаются с модуля — для других модулей.
 * Поведение v0.2.6: модуль должен быть стартовым в первом опубликованном
 * курсе, включающем его (`ModuleCoursesDqs.startsPublishedCourse`), и лишь
 * тогда из кандидатов (любой статус) остаются включающие модуль.
 */
export class GetCoursesStartingWithModuleUc extends UseCaseFromDef<
  typeof GetCoursesStartingWithModuleUcDef,
  CourseModuleDeps,
  Loaded
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetCoursesStartingWithModuleUcDef, deps, module);
  }

  protected async load({ moduleId, courseIds }: Input) {
    const published = await this.resolve.courses.findAll({
      status: 'published',
    });
    if (!new ModuleCoursesDqs(published).startsPublishedCourse(moduleId))
      return ok({ courses: [] });
    if (courseIds.length === 0) return ok({ courses: [] });
    return ok({ courses: await this.resolve.courses.findByIds(courseIds) });
  }

  protected async execute({ moduleId, courseIds }: Input, { courses }: Loaded) {
    const byId = new Map(courses.map((course) => [course.uuid, course]));
    const starting = courseIds.flatMap((courseId) => {
      const course = byId.get(courseId);
      return course?.includesModule(moduleId) ? [course.uuid] : [];
    });
    return ok({ courseIds: starting });
  }
}

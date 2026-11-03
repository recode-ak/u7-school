// Адаптер UC внешнего контракта над legacy-фасадом курсов.
import {
  type CourseModuleDef,
  GetCoursesStartingWithModuleUcDef,
} from '@u7-scl/domain/course/contract';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps } from '../../course.module';

type Input = ParsedInputOf<typeof GetCoursesStartingWithModuleUcDef>;

/**
 * Временная реализация `getCoursesStartingWithModule` поверх legacy:
 * модуль первый в опубликованном курсе (`getModulePlace`) — тогда курсы,
 * включающие его, решает `whichCoursesIncludeModule`; иначе пусто без
 * вопроса о курсах. Уходит с миграцией курсов.
 */
export class GetCoursesStartingWithModuleUc extends UseCaseFromDef<
  typeof GetCoursesStartingWithModuleUcDef,
  CourseModuleDeps,
  undefined
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetCoursesStartingWithModuleUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute({ moduleId, courseIds }: Input) {
    const { legacy } = this.resolve;
    const place = await legacy.getModulePlace(moduleId);
    if (!place?.isFirst) return ok({ courseIds: [] });
    const included = await legacy.whichCoursesIncludeModule(moduleId, [
      ...courseIds,
    ]);
    return ok({ courseIds: included });
  }
}

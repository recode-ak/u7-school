// Адаптер UC внешнего контракта над legacy-фасадом курсов.
import {
  type CourseModuleDef,
  GetCoursesIncludingModuleUcDef,
} from '@u7-scl/domain/course/contract';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps } from '../../course.module';

type Input = ParsedInputOf<typeof GetCoursesIncludingModuleUcDef>;

/**
 * `getCoursesIncludingModule` поверх legacy
 * `whichCoursesIncludeModule`: принадлежность модуля курсам, в т.ч.
 * историческую, решает legacy-код; ответ передаётся как есть.
 */
export class GetCoursesIncludingModuleUc extends UseCaseFromDef<
  typeof GetCoursesIncludingModuleUcDef,
  CourseModuleDeps,
  undefined
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetCoursesIncludingModuleUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute({ moduleId, courseIds }: Input) {
    const included = await this.resolve.legacy.whichCoursesIncludeModule(
      moduleId,
      [...courseIds],
    );
    return ok({ courseIds: included });
  }
}

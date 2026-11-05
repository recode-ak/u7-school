import {
  type ModulePrerequisite,
  ModulePrerequisiteDqs,
} from '@u7-scl/domain/course';
import {
  type CourseModuleDef,
  GetModulePrerequisiteUcDef,
} from '@u7-scl/domain/course/contract';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps } from '../../course.module';

type Loaded = { readonly verdict: ModulePrerequisite };
type Input = ParsedInputOf<typeof GetModulePrerequisiteUcDef>;

/**
 * Условие допуска к модулю — для других модулей: нужен ли пройденный
 * предыдущий модуль программы. Курсы читаются все (курс модуля — первый в
 * порядке файла, любой статус) — правило вердикта в `ModulePrerequisiteDqs`.
 */
export class GetModulePrerequisiteUc extends UseCaseFromDef<
  typeof GetModulePrerequisiteUcDef,
  CourseModuleDeps,
  Loaded
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetModulePrerequisiteUcDef, deps, module);
  }

  protected async load({ moduleId, passedModuleIds }: Input) {
    const [courses, modules] = await Promise.all([
      this.resolve.courses.findAll(),
      this.resolve.modules.findAll(),
    ]);
    return ok({
      verdict: new ModulePrerequisiteDqs(
        courses,
        modules,
        passedModuleIds,
      ).verdict(moduleId),
    });
  }

  protected async execute(_: Input, { verdict }: Loaded) {
    return ok(verdict);
  }
}

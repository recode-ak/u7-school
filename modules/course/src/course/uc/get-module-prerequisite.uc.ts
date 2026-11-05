import {
  type CourseAr,
  type ModuleAr,
  ModulePrerequisiteDqs,
} from '@u7-scl/domain/course';
import {
  type CourseModuleDef,
  GetModulePrerequisiteUcDef,
} from '@u7-scl/domain/course/contract';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps } from '../../course.module';

type Loaded = {
  readonly courses: readonly CourseAr[];
  readonly modules: readonly ModuleAr[];
};
type Input = ParsedInputOf<typeof GetModulePrerequisiteUcDef>;

/**
 * Условие допуска к модулю — для других модулей: нужен ли пройденный
 * предыдущий модуль программы. Курсы читаются все — правило вердикта в
 * `ModulePrerequisiteDqs` (курс модуля — первый в порядке файла, любой статус).
 */
export class GetModulePrerequisiteUc extends UseCaseFromDef<
  typeof GetModulePrerequisiteUcDef,
  CourseModuleDeps,
  Loaded
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetModulePrerequisiteUcDef, deps, module);
  }

  protected async load() {
    const [courses, modules] = await Promise.all([
      this.resolve.courses.findAll(),
      this.resolve.modules.findAll(),
    ]);
    return ok({ courses, modules });
  }

  protected async execute(
    { moduleId, passedModuleIds }: Input,
    { courses, modules }: Loaded,
  ) {
    return ok(
      new ModulePrerequisiteDqs(courses, modules, passedModuleIds).verdict(
        moduleId,
      ),
    );
  }
}

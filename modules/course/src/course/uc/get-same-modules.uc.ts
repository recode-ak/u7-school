// Адаптер UC внешнего контракта над legacy-фасадом курсов.
import {
  type CourseModuleDef,
  GetSameModulesUcDef,
} from '@u7-scl/domain/course/contract';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps } from '../../course.module';

type Input = ParsedInputOf<typeof GetSameModulesUcDef>;

/**
 * Временная реализация `getSameModules` поверх legacy `whichModulesAreSame`
 *: историческую идентичность модулей решает legacy-код; ответ
 * передаётся как есть. Уходит с миграцией курсов.
 */
export class GetSameModulesUc extends UseCaseFromDef<
  typeof GetSameModulesUcDef,
  CourseModuleDeps,
  undefined
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetSameModulesUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute({ moduleId, moduleIds }: Input) {
    const same = await this.resolve.legacy.whichModulesAreSame(moduleId, [
      ...moduleIds,
    ]);
    return ok({ moduleIds: same });
  }
}

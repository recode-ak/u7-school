import {
  type CourseModuleDef,
  GetSameModulesUcDef,
} from '@u7-scl/domain/course/contract';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps } from '../../course.module';

type Input = ParsedInputOf<typeof GetSameModulesUcDef>;

/**
 * Какие из модулей — тот же модуль — для других модулей: сегодня идентичность
 * — равенство id, повторы кандидатов сохраняются (D-65). Репозитории не
 * читаются: ответ — свойство входа.
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
    const same = moduleIds.filter((id) => id === moduleId);
    return ok({ moduleIds: same });
  }
}

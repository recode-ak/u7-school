// Адаптер UC внешнего контракта над legacy-фасадом курсов.
import { AppException } from '@u7-scl/core/domain';
import {
  CourseErrors,
  type CourseModuleDef,
  GetModuleSnapshotUcDef,
} from '@u7-scl/domain/course/contract';
import { err, ok } from 'dmg-core';
import { UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps } from '../../course.module';

/**
 * `getModuleSnapshot` поверх legacy `getModuleSnapshot`: снимок передаётся как
 * есть; `MODULE_NOT_FOUND` legacy — `COURSE_MODULE_NOT_FOUND`, остальное
 * пробрасывается и платформа отдаёт `SERVER_INTERNAL`.
 */
export class GetModuleSnapshotUc extends UseCaseFromDef<
  typeof GetModuleSnapshotUcDef,
  CourseModuleDeps,
  undefined
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetModuleSnapshotUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute({ moduleId }: { moduleId: string }) {
    try {
      return ok(await this.resolve.legacy.getModuleSnapshot(moduleId));
    } catch (error) {
      if (
        error instanceof AppException &&
        error.error.name === 'MODULE_NOT_FOUND'
      ) {
        return err(CourseErrors.MODULE_NOT_FOUND.make({ moduleId }));
      }
      throw error;
    }
  }
}

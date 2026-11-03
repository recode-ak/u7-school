// Адаптер UC внешнего контракта над legacy-фасадом курсов.
import {
  type CourseModuleDef,
  GetModuleEnrollmentUcDef,
} from '@u7-scl/domain/course/contract';
import { ok } from 'dmg-core';
import { UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps } from '../../course.module';

/**
 * `getModuleEnrollment` поверх legacy `getModulePlace`: место модуля в программе опубликованного курса решает legacy-код;
 * адаптер лишь переводит «есть место» в `enrollable`.
 */
export class GetModuleEnrollmentUc extends UseCaseFromDef<
  typeof GetModuleEnrollmentUcDef,
  CourseModuleDeps,
  undefined
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetModuleEnrollmentUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute({ moduleId }: { moduleId: string }) {
    const place = await this.resolve.legacy.getModulePlace(moduleId);
    return ok({ enrollable: place !== undefined });
  }
}

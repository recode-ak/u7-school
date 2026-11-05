// Адаптер UC внешнего контракта над legacy-фасадом курсов.
import { LegacyCourseAr } from '@u7-scl/domain/course';
import {
  type CourseModuleDef,
  GetModulePrerequisiteUcDef,
} from '@u7-scl/domain/course/contract';
import { ok } from 'dmg-core';
import { UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps } from '../../course.module';

/**
 * `getModulePrerequisite` поверх legacy `getCourseByModuleId` +
 * `LegacyCourseAr.getPrevModuleId` + `getModule`: курса нет или модуль входной —
 * `none`; модуля нет в порядке курса — `closed`; иначе `module`. Название
 * предыдущего модуля не получено — вместо него его id.
 */
export class GetModulePrerequisiteUc extends UseCaseFromDef<
  typeof GetModulePrerequisiteUcDef,
  CourseModuleDeps,
  undefined
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetModulePrerequisiteUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  protected async execute({ moduleId }: { moduleId: string }) {
    const { legacy } = this.resolve;
    const course = await legacy.getCourseByModuleId(moduleId);
    if (!course) return ok({ gate: 'none' as const });
    const prevModuleId = new LegacyCourseAr(course).getPrevModuleId(moduleId);
    if (prevModuleId === undefined) return ok({ gate: 'none' as const });
    if (prevModuleId === null) return ok({ gate: 'closed' as const });
    try {
      const prev = await legacy.getModule(prevModuleId);
      return ok({
        gate: 'module' as const,
        moduleId: prevModuleId,
        title: prev.title,
      });
    } catch {
      return ok({
        gate: 'module' as const,
        moduleId: prevModuleId,
        title: prevModuleId,
      });
    }
  }
}

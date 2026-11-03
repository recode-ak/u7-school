// Адаптер UC внешнего контракта над legacy-фасадом курсов.
import {
  type CourseModuleDef,
  GetCourseEnrollmentUcDef,
} from '@u7-scl/domain/course/contract';
import { ok } from 'dmg-core';
import { UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps } from '../../course.module';

/**
 * Временная реализация `getCourseEnrollment` поверх legacy-фасада курсов
 *: модуль курсов не мигрирован (D-37), решение «доступен ли курс и
 * с какого модуля» принимает legacy-код. Ветвление по ответам legacy — часть
 * адаптера, не прикладной логики; уходит вместе с адаптером при миграции.
 */
export class GetCourseEnrollmentUc extends UseCaseFromDef<
  typeof GetCourseEnrollmentUcDef,
  CourseModuleDeps,
  undefined
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetCourseEnrollmentUcDef, deps, module);
  }

  protected async load() {
    return ok(undefined);
  }

  /** Не опубликован/архив/пустая программа — неотличимы: `enrollable: false`. */
  protected async execute({ courseId }: { courseId: string }) {
    const { legacy } = this.resolve;
    if (!(await legacy.isCourseEnrollable(courseId))) {
      return ok({ enrollable: false as const });
    }
    const startModuleId = await legacy.getCourseStartModuleId(courseId);
    return ok(
      startModuleId === undefined
        ? { enrollable: false as const }
        : { enrollable: true as const, startModuleId },
    );
  }
}

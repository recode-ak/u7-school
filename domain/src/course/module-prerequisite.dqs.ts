import type { ReadonlyAr } from 'dmg-core';
import type { CourseAr } from './course/course.ar';
import type { ModulePrerequisite } from './course/uc/get-module-prerequisite.uc';
import type { ModuleAr } from './module/module.ar';
import { ModuleCoursesDqs } from './module-courses.dqs';

/**
 * DQS вердикта допуска к модулю (D-65): нужен ли пройденный предыдущий модуль
 * программы и есть ли его запись. Курс модуля — первый в порядке файла из
 * всех, включающих модуль (поведение v0.2.6, правило — `ModuleCoursesDqs`).
 *
 * Принадлежность «предыдущий пройден» решает курс: `passedModuleIds`
 * приходят от клиента готовыми (позже за этим методом встанет история
 * модулей). Только читает.
 */
export class ModulePrerequisiteDqs {
  constructor(
    private readonly courses: readonly ReadonlyAr<CourseAr>[],
    private readonly modules: readonly ReadonlyAr<ModuleAr>[],
    private readonly passedModuleIds: readonly string[],
  ) {}

  /** Вердикт: допуск, «предыдущий не пройден» с названием или «закрыто». */
  verdict(moduleId: string): ModulePrerequisite {
    const course = new ModuleCoursesDqs(this.courses).firstIncluding(moduleId);
    if (course === undefined) return { admitted: true };

    // Курс выбран по вхождению модуля, поэтому место есть всегда.
    const prevModuleId = course.placeOf(moduleId)?.prevModuleId;
    if (prevModuleId === undefined) return { admitted: true };
    if (this.passedModuleIds.includes(prevModuleId)) return { admitted: true };

    const previous = this.modules.find(
      (module) => module.uuid === prevModuleId,
    );
    if (previous === undefined) {
      return { admitted: false, reason: 'closed' };
    }
    return {
      admitted: false,
      reason: 'previous-not-passed',
      title: previous.summary().title,
    };
  }
}

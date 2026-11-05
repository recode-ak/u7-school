import type { ReadonlyAr } from 'dmg-core';
import type { CourseAr } from './course/course.ar';

/**
 * DQS «какой курс у модуля»: единственное место правила выбора курса модуля.
 * `firstIncluding` — любой статус (`getCourseByModule`, `getModulePrerequisite`),
 * `firstPublishedIncluding` — только опубликованные (`getModulePlace`,
 * `getModuleEnrollment`); порядок массива — порядок файла, он часть поведения.
 * Правило — долг в реестре, см. `conductor/architecture/debt.md`. Только читает.
 */
export class ModuleCoursesDqs {
  constructor(private readonly courses: readonly ReadonlyAr<CourseAr>[]) {}

  /** Первый в порядке файла курс, включающий модуль, — любого статуса. */
  firstIncluding(moduleId: string): ReadonlyAr<CourseAr> | undefined {
    return this.courses.find((course) => course.includesModule(moduleId));
  }

  /** Первый в порядке файла опубликованный курс, включающий модуль. */
  firstPublishedIncluding(moduleId: string): ReadonlyAr<CourseAr> | undefined {
    return this.courses.find(
      (course) => course.isPublished() && course.includesModule(moduleId),
    );
  }

  /** Модуль стартовый в первом опубликованном курсе, включающем его. */
  startsPublishedCourse(moduleId: string): boolean {
    const course = this.firstPublishedIncluding(moduleId);
    return course?.placeOf(moduleId)?.isFirst === true;
  }
}

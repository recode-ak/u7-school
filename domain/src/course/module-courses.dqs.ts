import type { ReadonlyAr } from 'dmg-core';
import type { CourseAr } from './course/course.ar';

/**
 * DQS «какой курс у модуля»: единственное место правила выбора курса модуля
 * (С2 брифа `course`; до сведения в одно место их было три). Поведение
 * v0.2.6 сохранено: `firstIncluding` — любой статус (`getCourseByModule`,
 * `getModulePrerequisite`), `firstPublishedIncluding` — только опубликованные
 * (`getModulePlace`, `getModuleEnrollment`). Порядок массива — порядок файла,
 * он часть поведения. Только читает.
 *
 * Долг: две ветки правила (любой статус / опубликованный) — до появления
 * архивации курсов и истории модулей; замена — правка одного места.
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
}

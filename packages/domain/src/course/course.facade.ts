import type { CallContext, OutputOf, Result, UseCaseErrorOf } from 'dmg-core';
import type { GetCourseEnrollmentUcDef } from './course/uc/get-course-enrollment.uc';

/** Ответ о записи на курс: стартовый модуль или «недоступен для записи». */
export type CourseEnrollment = OutputOf<typeof GetCourseEnrollmentUcDef>;

/**
 * Фасад модуля курсов по D-42 — рантайм-граница для других модулей: обычный
 * TS-тип, не Def. Каждый метод — обёртка над UC модуля: первый аргумент —
 * контекст вызова операции-потребителя, ошибки — ошибки UC.
 *
 * Имя — не `CourseFacade`: его занимает legacy-фасад (`facade.ts`) до
 * миграции модуля.
 */
export type CourseModuleFacade = {
  /** Доступен ли курс для записи и с какого модуля она начинается (UC `getCourseEnrollment`). */
  getCourseEnrollment(
    call: CallContext,
    courseId: string,
  ): Promise<
    Result<CourseEnrollment, UseCaseErrorOf<typeof GetCourseEnrollmentUcDef>>
  >;
};

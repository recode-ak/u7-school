import { type CourseAr, ModuleCoursesDqs } from '@u7-scl/domain/course';
import {
  type CourseModuleDef,
  GetModulePlaceUcDef,
} from '@u7-scl/domain/course/contract';
import { ok } from 'dmg-core';
import { type ParsedInputOf, UseCaseFromDef } from 'dmg-core/app';
import type { CourseModuleDeps, CourseUser } from '../../course.module';

type Loaded = { readonly courses: readonly CourseAr[] };
type Input = ParsedInputOf<typeof GetModulePlaceUcDef>;

/**
 * Место модуля в программе опубликованного курса: первый такой курс в
 * порядке файла (правило — `ModuleCoursesDqs`), соседи по линейному порядку
 * и этап. Модуль вне опубликованных курсов — пусто, а не ошибка.
 */
export class GetModulePlaceUc extends UseCaseFromDef<
  typeof GetModulePlaceUcDef,
  CourseModuleDeps,
  Loaded,
  CourseUser
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetModulePlaceUcDef, deps, module);
  }

  protected async load() {
    return ok({
      courses: await this.resolve.courses.findAll({ status: 'published' }),
    });
  }

  protected async execute({ moduleId }: Input, { courses }: Loaded) {
    const course = new ModuleCoursesDqs(courses).firstPublishedIncluding(
      moduleId,
    );
    const place = course?.placeOf(moduleId);
    if (course === undefined || place === undefined) return ok(undefined);
    return ok({ courseId: course.uuid, ...place });
  }
}

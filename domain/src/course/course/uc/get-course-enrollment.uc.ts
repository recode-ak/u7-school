import { allowAll, F, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { CourseArDef } from '../course.ar';

/**
 * Запись на курс — для других модулей (D-42): с какого модуля она
 * начинается. Курс не найден, не опубликован, в архиве или с пустой
 * программой — для записи неотличимы: `enrollable: false`, без причины
 * (статус курса — внутренняя кухня модуля курсов).
 *
 * `allowAll`: ответ не зависит от субъекта — опубликованный курс виден
 * любому, кто может на него записаться; закрытое доступно только как
 * «недоступен».
 */
export const GetCourseEnrollmentUcDef = UseCaseDef.define({
  name: 'getCourseEnrollment',
  label: 'Запись на курс',
  description:
    'Доступен ли курс для записи и с какого модуля она начинается — для других модулей.',
  type: 'query',
  aggregate: CourseArDef,
  callers: ['system'],
  policy: allowAll,
  input: v.object({ courseId: F.uuid('курса') }),
  output: v.variant('enrollable', [
    v.object({
      enrollable: v.pipe(
        v.literal(true),
        v.description('Курс доступен для записи'),
      ),
      startModuleId: F.uuid(
        'стартового модуля: первого в линейном порядке фаз курса',
      ),
    }),
    v.object({
      enrollable: v.pipe(
        v.literal(false),
        v.description(
          'Курс недоступен для записи: не найден, не опубликован, в архиве или без модулей',
        ),
      ),
    }),
  ]),
  errors: [],
});

/** Ответ о записи на курс: стартовый модуль или «недоступен для записи». */
export type CourseEnrollment = OutputOf<typeof GetCourseEnrollmentUcDef>;

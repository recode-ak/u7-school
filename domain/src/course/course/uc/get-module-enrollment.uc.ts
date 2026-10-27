import { allowAll, F, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { CourseArDef } from '../course.ar';

/**
 * Запись на модуль — для других модулей: входит ли модуль в программу
 * опубликованного курса. Модуль не найден или только в черновых/архивных
 * курсах — для записи неотличимы: `enrollable: false`, без причины.
 * Места модуля в программе в ответе нет — потребителя нет.
 *
 * `allowAll`: как у `getCourseEnrollment` — ответ не зависит от субъекта,
 * опубликованное доступно любому, закрытое видно лишь как «недоступно».
 */
export const GetModuleEnrollmentUcDef = UseCaseDef.define({
  name: 'getModuleEnrollment',
  label: 'Запись на модуль',
  description:
    'Входит ли модуль в программу опубликованного курса, на который можно записаться, — для других модулей.',
  type: 'query',
  aggregate: CourseArDef,
  callers: ['system'],
  policy: allowAll,
  input: v.object({ moduleId: F.uuid('модуля') }),
  output: v.object({
    enrollable: v.pipe(
      v.boolean(),
      v.description(
        'Модуль входит в программу опубликованного курса и доступен для записи',
      ),
    ),
  }),
  errors: [],
});

/** Ответ о записи на модуль: доступен ли он для записи. */
export type ModuleEnrollment = OutputOf<typeof GetModuleEnrollmentUcDef>;

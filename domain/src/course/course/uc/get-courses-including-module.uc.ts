import { allowAll, F, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { CourseArDef } from '../course.ar';

/**
 * Какие из курсов включают модуль — для других модулей: батч-ответ по
 * курсам-кандидатам за один вызов. Принадлежность — в т.ч. историческая
 * (форки, архивные курсы): её решает модуль курсов. Неизвестный курс —
 * просто не попадает в ответ, без ошибки.
 *
 * `allowAll`: ответ не зависит от субъекта — это факт о программе курсов,
 * а не доступ к их содержимому.
 */
export const GetCoursesIncludingModuleUcDef = UseCaseDef.define({
  name: 'getCoursesIncludingModule',
  label: 'Курсы, включающие модуль',
  description:
    'Какие из переданных курсов включают модуль в свою программу, в том числе исторически, — для других модулей.',
  type: 'query',
  aggregate: CourseArDef,
  callers: ['system'],
  policy: allowAll,
  input: v.object({
    moduleId: F.uuid('модуля'),
    courseIds: v.pipe(
      v.array(F.uuid('курса')),
      v.description('Курсы-кандидаты, принадлежность которым проверяется'),
    ),
  }),
  output: v.object({
    courseIds: v.pipe(
      v.array(F.uuid('курса')),
      v.description('Те из курсов-кандидатов, которые включают модуль'),
    ),
  }),
  errors: [],
});

/** Ответ: курсы-кандидаты, включающие модуль. */
export type CoursesIncludingModule = OutputOf<
  typeof GetCoursesIncludingModuleUcDef
>;

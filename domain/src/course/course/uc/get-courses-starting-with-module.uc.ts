import { allowAll, F, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { CourseArDef } from '../course.ar';

/**
 * Какие из курсов начинаются с модуля — для других модулей: модуль —
 * стартовый в опубликованном курсе, и курс включает его (в т.ч. исторически,
 * форки). Батч по курсам-кандидатам за один вызов; решает модуль курсов.
 * Неизвестный курс — просто не попадает в ответ, без ошибки.
 *
 * `allowAll`: ответ не зависит от субъекта — это факт о программе курсов,
 * а не доступ к их содержимому.
 */
export const GetCoursesStartingWithModuleUcDef = UseCaseDef.define({
  name: 'getCoursesStartingWithModule',
  label: 'Курсы, начинающиеся с модуля',
  description:
    'Какие из переданных курсов начинаются с модуля: он стартовый в опубликованном курсе, и курс включает его, в том числе исторически, — для других модулей.',
  type: 'query',
  aggregate: CourseArDef,
  callers: ['system'],
  policy: allowAll,
  input: v.object({
    moduleId: F.uuid('модуля'),
    courseIds: v.pipe(
      v.array(F.uuid('курса')),
      v.description('Курсы-кандидаты, начало которых проверяется'),
    ),
  }),
  output: v.object({
    courseIds: v.pipe(
      v.array(F.uuid('курса')),
      v.description('Те из курсов-кандидатов, что начинаются с модуля'),
    ),
  }),
  errors: [],
});

/** Ответ: курсы-кандидаты, начинающиеся с модуля. */
export type CoursesStartingWithModule = OutputOf<
  typeof GetCoursesStartingWithModuleUcDef
>;

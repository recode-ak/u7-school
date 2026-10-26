import { allowAll, defineUseCase, F, type OutputOf } from 'dmg-core';
import * as v from 'valibot';
import { CourseArDef } from '../course.ar';

/**
 * Какие из модулей — тот же модуль — для других модулей: историческая
 * идентичность (копия модуля с другим id — тот же модуль), батч по
 * модулям-кандидатам за один вызов. Идентичность решает модуль курсов.
 *
 * `allowAll`: ответ не зависит от субъекта — это факт о модулях, а не доступ
 * к их содержимому.
 */
export const GetSameModulesUcDef = defineUseCase({
  name: 'getSameModules',
  label: 'Тот же модуль',
  description:
    'Какие из переданных модулей исторически тот же модуль, что указанный, — для других модулей.',
  type: 'query',
  aggregate: CourseArDef,
  callers: ['system'],
  policy: allowAll,
  input: v.object({
    moduleId: F.uuid('модуля'),
    moduleIds: v.pipe(
      v.array(F.uuid('модуля')),
      v.description('Модули-кандидаты, идентичность которых проверяется'),
    ),
  }),
  output: v.object({
    moduleIds: v.pipe(
      v.array(F.uuid('модуля')),
      v.description('Те из модулей-кандидатов, что исторически тот же модуль'),
    ),
  }),
  errors: [],
});

/** Ответ: модули-кандидаты, исторически тот же модуль. */
export type SameModules = OutputOf<typeof GetSameModulesUcDef>;

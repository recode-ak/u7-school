import { allowAll, F, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { CourseArDef } from '../course.ar';

/** Вердикт «допуск закрыт»: записи предыдущего модуля нет в `modules.json`. */
const closed = v.object({
  admitted: v.pipe(v.literal(false), v.description('Допуска к модулю нет')),
  reason: v.pipe(
    v.literal('closed'),
    v.description('Предыдущий модуль курса определить нельзя'),
  ),
});

/** Вердикт «предыдущий модуль не пройден»: его название — для текста отказа. */
const previousNotPassed = v.object({
  admitted: v.pipe(v.literal(false), v.description('Допуска к модулю нет')),
  reason: v.pipe(
    v.literal('previous-not-passed'),
    v.description('Не пройден предыдущий модуль программы'),
  ),
  title: v.pipe(
    v.string(),
    v.description('Название предыдущего модуля — для текста отказа'),
  ),
});

/**
 * Условие допуска к модулю — для других модулей (зачисление на поток).
 * Вердикт по `admitted`: курса нет, модуль входной или предыдущий пройден —
 * допуск есть; иначе причина отказа. Принадлежность «пройден» решает курс:
 * клиент ничего не сравнивает (D-65).
 *
 * `allowAll`: вызывает система (UC другого модуля), ответ не зависит от субъекта.
 */
export const GetModulePrerequisiteUcDef = UseCaseDef.define({
  name: 'getModulePrerequisite',
  label: 'Условие допуска к модулю',
  description:
    'Допуск к записи на модуль: нужен ли пройденный предыдущий модуль курса и можно ли его определить — для других модулей.',
  type: 'query',
  aggregate: CourseArDef,
  callers: ['system'],
  policy: allowAll,
  input: v.object({
    moduleId: F.uuid('модуля'),
    passedModuleIds: v.pipe(
      v.array(F.uuid('модуля')),
      v.description('Модули, которые студент уже прошёл'),
    ),
  }),
  output: v.variant('admitted', [
    v.object({
      admitted: v.pipe(
        v.literal(true),
        v.description('Допуск есть: условия нет или предыдущий модуль пройден'),
      ),
    }),
    v.variant('reason', [previousNotPassed, closed]),
  ]),
  errors: [],
});

/** Условие допуска к модулю: ответ `getModulePrerequisite`. */
export type ModulePrerequisite = OutputOf<typeof GetModulePrerequisiteUcDef>;

import { allowAll, F, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { CourseArDef } from '../course.ar';

/**
 * Условие допуска к модулю — для других модулей (зачисление на поток).
 * Ответ по виду `gate`: `none` — курса нет или модуль входной, `module` —
 * нужно пройти предыдущий модуль (его id и название), `closed` — предыдущий
 * модуль курса определить нельзя.
 *
 * `allowAll`: вызывает система (UC другого модуля), ответ не зависит от субъекта.
 */
export const GetModulePrerequisiteUcDef = UseCaseDef.define({
  name: 'getModulePrerequisite',
  label: 'Условие допуска к модулю',
  description:
    'Какой модуль нужно пройти до записи на указанный: нет условия, предыдущий модуль курса или допуск закрыт — для других модулей.',
  type: 'query',
  aggregate: CourseArDef,
  callers: ['system'],
  policy: allowAll,
  input: v.object({ moduleId: F.uuid('модуля') }),
  output: v.variant('gate', [
    v.object({
      gate: v.pipe(
        v.literal('none'),
        v.description('Условия допуска нет: курса нет или модуль входной'),
      ),
    }),
    v.object({
      gate: v.pipe(
        v.literal('module'),
        v.description('Нужно пройти предыдущий модуль'),
      ),
      moduleId: F.uuid('предыдущего модуля'),
      title: v.pipe(v.string(), v.description('Название предыдущего модуля')),
    }),
    v.object({
      gate: v.pipe(
        v.literal('closed'),
        v.description('Допуск закрыт: предыдущий модуль определить нельзя'),
      ),
    }),
  ]),
  errors: [],
});

/** Условие допуска к модулю: ответ `getModulePrerequisite`. */
export type ModulePrerequisite = OutputOf<typeof GetModulePrerequisiteUcDef>;

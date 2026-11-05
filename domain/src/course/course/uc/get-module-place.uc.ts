import { allowAll, F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { CourseArDef } from '../course.ar';

/** Этап, в который входит модуль: позиция в курсе и заголовок. */
export const ModuleStage = v.object({
  index: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(0),
    v.description('Номер этапа в курсе с нуля'),
  ),
  title: v.pipe(v.string(), v.description('Заголовок этапа')),
  track: v.pipe(
    v.optional(v.string()),
    v.description('Трек этапа: tech, design'),
  ),
});

/** Место модуля в программе курса (линейный порядок этапов). */
export const ModulePlace = v.object({
  courseId: F.uuid('курса'),
  isFirst: v.pipe(
    v.boolean(),
    v.description('Модуль первый в программе курса'),
  ),
  isLast: v.pipe(
    v.boolean(),
    v.description('Модуль последний в программе курса'),
  ),
  prevModuleId: v.pipe(
    v.optional(F.uuid('предыдущего модуля')),
    v.description('Модуль, который идёт перед этим'),
  ),
  nextModuleId: v.pipe(
    v.optional(F.uuid('следующего модуля')),
    v.description('Модуль, который идёт после этого'),
  ),
  stage: v.pipe(
    v.optional(ModuleStage),
    v.description('Этап курса, в который входит модуль'),
  ),
});

export type ModulePlace = v.InferOutput<typeof ModulePlace>;

/**
 * Место модуля в программе опубликованного курса: первый такой курс в
 * порядке файла (поведение v0.2.6, правило — `ModuleCoursesDqs`). Модуль вне
 * опубликованных курсов — пусто, а не ошибка (Т17).
 */
export const GetModulePlaceUcDef = UseCaseDef.define({
  name: 'getModulePlace',
  label: 'Место модуля в курсе',
  description:
    'Место модуля в программе опубликованного курса: соседи по порядку и этап; модуль вне курсов — пусто.',
  type: 'query',
  aggregate: CourseArDef,
  callers: ['user', 'guest'],
  policy: allowAll,
  input: v.object({ moduleId: F.uuid('модуля') }),
  output: v.pipe(
    v.optional(ModulePlace),
    v.description(
      'Место модуля; пусто — модуль не входит в опубликованные курсы',
    ),
  ),
  errors: [],
});

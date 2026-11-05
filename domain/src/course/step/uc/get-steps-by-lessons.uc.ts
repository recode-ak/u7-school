import { allowAll, F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StepArDef } from '../step.ar';

/** Шаг в списке шагов урока: идентификатор и описание для навигации. */
export const StepsByLessonItem = v.object({
  uuid: F.uuid('шага'),
  description: v.pipe(
    v.string(),
    v.nonEmpty('Описание шага не может быть пустым'),
    v.description('Описание шага'),
  ),
});

/**
 * Шаги уроков, сгруппированные по уроку: видимые шаги в порядке `stepIds`.
 * Ошибок нет — невидимые и отсутствующие шаги молча пропускаются, урок без
 * видимых шагов в ответ не попадает.
 */
export const GetStepsByLessonsUcDef = UseCaseDef.define({
  name: 'getStepsByLessons',
  label: 'Шаги уроков',
  description:
    'Шаги уроков по порядку прохождения — для навигации по уроку; невидимые шаги пропускаются.',
  type: 'query',
  aggregate: StepArDef,
  callers: ['user', 'guest'],
  policy: allowAll,
  input: v.object({
    lessonIds: v.pipe(v.array(F.uuid('урока')), v.description('Уроки')),
  }),
  output: v.pipe(
    v.record(
      F.uuid('урока'),
      v.pipe(v.array(StepsByLessonItem), v.description('Шаги урока')),
    ),
    v.description('Шаги, сгруппированные по уроку'),
  ),
  errors: [],
});

export type StepsByLesson = v.InferOutput<typeof GetStepsByLessonsUcDef.output>;

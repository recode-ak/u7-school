import { allowAll, F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { CourseArDef, CourseView } from '../course.ar';
import { CourseErrors } from '../course.errors';

/**
 * Курс по идентификатору: чтение открыто всем, статус курс не скрывает —
 * варианта «виден только автору» в срезе нет (С1, вариант А).
 */
export const GetCourseUcDef = UseCaseDef.define({
  name: 'getCourse',
  label: 'Курс',
  description:
    'Курс по идентификатору: программа из модулей и этапы, любого статуса.',
  type: 'query',
  aggregate: CourseArDef,
  callers: ['user', 'guest'],
  policy: allowAll,
  input: v.object({ courseId: F.uuid('курса') }),
  output: CourseView,
  errors: [CourseErrors.NOT_FOUND],
});

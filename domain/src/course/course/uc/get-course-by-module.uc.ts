import { allowAll, F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { CourseArDef, CourseView } from '../course.ar';

/**
 * Курс, в программу которого входит модуль: любого статуса, первый в порядке
 * файла (правило собрано в `ModuleCoursesDqs`). Модуля нет ни в одном курсе —
 * пусто, а не ошибка.
 */
export const GetCourseByModuleUcDef = UseCaseDef.define({
  name: 'getCourseByModule',
  label: 'Курс модуля',
  description:
    'Курс, в программу которого входит модуль, любого статуса; модуль вне курсов — пусто.',
  type: 'query',
  aggregate: CourseArDef,
  callers: ['user', 'guest'],
  policy: allowAll,
  input: v.object({ moduleId: F.uuid('модуля') }),
  output: v.pipe(
    v.optional(CourseView),
    v.description('Курс модуля; пусто — модуль не входит ни в один курс'),
  ),
  errors: [],
});

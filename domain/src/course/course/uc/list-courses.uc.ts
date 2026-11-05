import { allowAll, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { CourseArDef, CourseView } from '../course.ar';
import { CourseState } from '../course.state';

const { entries } = CourseState;

/**
 * Курсы для показа: без `status` — только опубликованные (как в v0.2.6),
 * выборка и сортировка — репозитория. `stages` в ответе нужны навигации.
 */
export const ListCoursesUcDef = UseCaseDef.define({
  name: 'listCourses',
  label: 'Курсы',
  description:
    'Список курсов с фильтрами по статусу, автору и названию — с программой и этапами.',
  type: 'query',
  aggregate: CourseArDef,
  callers: ['user', 'guest'],
  policy: allowAll,
  input: v.object({
    status: v.pipe(
      v.optional(entries.status),
      v.description('Только курсы в этом статусе; без него — опубликованные'),
    ),
    authorId: v.pipe(
      v.optional(entries.authorId),
      v.description('Только курсы этого автора'),
    ),
    title: v.pipe(
      v.optional(v.string()),
      v.description('Подстрока заголовка курса без учёта регистра'),
    ),
    sort: v.pipe(
      v.optional(v.string()),
      v.description('Порядок: `createdAt|title:asc|desc`'),
    ),
    limit: v.pipe(
      v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
      v.description('Сколько курсов вернуть'),
    ),
  }),
  output: v.pipe(v.array(CourseView), v.description('Курсы')),
  errors: [],
});

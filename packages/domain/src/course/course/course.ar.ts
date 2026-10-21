import { BaseEntityFields, defineAggregate, defineErrors } from 'dmg-core';
import * as v from 'valibot';

/**
 * Def агрегата внешнего модуля (D-37): нужен Def UC модуля (`aggregate`).
 * Состояние, события и ошибки — пустой минимум; агрегат реализует legacy-код
 * (`CourseAr`). При миграции модуля Def наполняется.
 */
export const CourseArDef = defineAggregate({
  name: 'course',
  label: 'Курс',
  description: 'Курс: программа из фаз и модулей, публикуется для записи.',
  state: v.object({ ...BaseEntityFields }),
  events: {},
  errors: defineErrors('COURSE', {}),
});

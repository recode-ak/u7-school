import { AggregateDef, BaseEntityFields } from 'dmg-core';
import * as v from 'valibot';
import { CourseErrors } from './course.errors';

/**
 * Def агрегата внешнего модуля (D-37): нужен Def UC модуля (`aggregate`).
 * Состояние и события — пустой минимум, ошибки — только контрактные; агрегат реализует legacy-код
 * (`LegacyCourseAr`). При миграции модуля Def наполняется.
 */
export const CourseArDef = AggregateDef.define({
  name: 'course',
  label: 'Курс',
  description: 'Курс: программа из фаз и модулей, публикуется для записи.',
  state: v.object({ ...BaseEntityFields }),
  events: {},
  errors: CourseErrors,
});

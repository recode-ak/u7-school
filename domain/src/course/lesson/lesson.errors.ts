import { ErrorDef, F } from 'dmg-core';
import * as v from 'valibot';

/**
 * Ошибки агрегата `lesson`. Отказ видимости неопубликованного — базовая
 * `ACCESS_DENIED` ядра (решение принимает Policy), а не код этой группы.
 */
export const LessonErrors = ErrorDef.define('LESSON', {
  NOT_FOUND: {
    kind: 'not_found',
    label: 'Урок не найден',
    description: 'Урока с таким идентификатором нет.',
    payload: v.object({ lessonId: F.uuid('урока') }),
  },
});

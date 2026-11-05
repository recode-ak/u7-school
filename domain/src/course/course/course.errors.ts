import { ErrorDef, F } from 'dmg-core';
import * as v from 'valibot';

/**
 * Ошибки курсов, видимые другим модулям (контракт). «Модуль не найден» —
 * `ModuleErrors.NOT_FOUND` по ссылке (ERR-03): у курса такой ошибки нет (Т8).
 */
export const CourseErrors = ErrorDef.define('COURSE', {
  NOT_FOUND: {
    kind: 'not_found',
    label: 'Курс не найден',
    description: 'Курса с таким идентификатором нет.',
    payload: v.object({ courseId: F.uuid('курса') }),
  },
});

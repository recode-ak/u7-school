import { ErrorDef, F } from 'dmg-core';
import * as v from 'valibot';

/**
 * Ошибки курсов, видимые другим модулям (контракт). Остальные ошибки
 * модуля — legacy (`CourseModuleError`), пока агрегат не переведён на Def.
 */
export const CourseErrors = ErrorDef.define('COURSE', {
  MODULE_NOT_FOUND: {
    kind: 'not_found',
    label: 'Модуль не найден',
    description: 'Модуля с таким идентификатором нет.',
    payload: v.object({ moduleId: F.uuid('модуля') }),
  },
});

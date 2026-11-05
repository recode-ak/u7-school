import { ErrorDef, F } from 'dmg-core';
import * as v from 'valibot';

/**
 * Ошибки агрегата `module`. Отказ видимости неопубликованного — базовая
 * `ACCESS_DENIED` ядра (решение принимает Policy), а не код этой группы.
 */
export const ModuleErrors = ErrorDef.define('MODULE', {
  NOT_FOUND: {
    kind: 'not_found',
    label: 'Модуль не найден',
    description: 'Модуля с таким идентификатором нет.',
    payload: v.object({ moduleId: F.uuid('модуля') }),
  },
});

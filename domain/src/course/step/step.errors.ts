import { ErrorDef, F } from 'dmg-core';
import * as v from 'valibot';

/**
 * Ошибки агрегата `step`. Отказ видимости неопубликованного — базовая
 * `ACCESS_DENIED` ядра (решение принимает Policy), а не код этой группы.
 */
export const StepErrors = ErrorDef.define('STEP', {
  NOT_FOUND: {
    kind: 'not_found',
    label: 'Шаг не найден',
    description: 'Шага с таким идентификатором нет.',
    payload: v.object({ stepId: F.uuid('шага') }),
  },
});

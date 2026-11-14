import { allowAll, F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StepArDef, StepView } from '../step.ar';

/**
 * Шаги по списку — для модуля `stream`: чтение шагов снимка потока без
 * статусного фильтра. Право «шаг в снимке, вызывающий — участник потока»
 * держит `stream`; поэтому только `system` (у вызова нет субъекта для
 * `ModulePolicy`). Отсутствующий шаг пропускается, ошибок нет.
 */
export const GetSnapshotStepsUcDef = UseCaseDef.define({
  name: 'getSnapshotSteps',
  label: 'Шаги снимка потока',
  description:
    'Шаги по списку идентификаторов в порядке списка, любого статуса — для чтения материалов потока по снимку; отсутствующие пропускаются.',
  type: 'query',
  aggregate: StepArDef,
  callers: ['system'],
  policy: allowAll,
  input: v.object({
    stepIds: v.pipe(v.array(F.uuid('шага')), v.description('Шаги снимка')),
  }),
  output: v.pipe(v.array(StepView), v.description('Шаги в порядке запроса')),
  errors: [],
});

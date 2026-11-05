import { allowAll, F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { ModuleErrors } from '../../module/module.errors';
import { StepArDef, StepView } from '../step.ar';
import { StepErrors } from '../step.errors';

/**
 * Шаг для показа: чтение открыто всем, право на неопубликованное считает
 * `ModulePolicy` здесь — гость субъекта не имеет, правилом Def UC это не
 * выражается, а `undefined` от `viewFor` становится отказом.
 */
export const GetStepUcDef = UseCaseDef.define({
  name: 'getStep',
  label: 'Шаг',
  description:
    'Шаг по идентификатору: неопубликованный виден автору и администратору модуля-владельца, остальным — отказ.',
  type: 'query',
  aggregate: StepArDef,
  callers: ['user', 'guest'],
  policy: allowAll,
  input: v.object({ stepId: F.uuid('шага') }),
  output: StepView,
  errors: [StepErrors.NOT_FOUND, ModuleErrors.NOT_FOUND],
});

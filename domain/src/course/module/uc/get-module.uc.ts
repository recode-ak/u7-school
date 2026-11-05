import { allowAll, F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { ModuleArDef, ModuleView } from '../module.ar';
import { ModuleErrors } from '../module.errors';

/**
 * Модуль для показа: чтение открыто всем, право на неопубликованное считает
 * `ModulePolicy` здесь — гость субъекта не имеет, правилом Def UC это не
 * выражается, а `undefined` от `viewFor` становится отказом.
 */
export const GetModuleUcDef = UseCaseDef.define({
  name: 'getModule',
  label: 'Модуль',
  description:
    'Модуль по идентификатору: неопубликованный виден автору и администратору, остальным — отказ.',
  type: 'query',
  aggregate: ModuleArDef,
  callers: ['user', 'guest'],
  policy: allowAll,
  input: v.object({ moduleId: F.uuid('модуля') }),
  output: ModuleView,
  errors: [ModuleErrors.NOT_FOUND],
});

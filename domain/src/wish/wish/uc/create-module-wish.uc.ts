import { GetModuleEnrollmentUcDef } from '@u7-scl/domain/course/contract';
import { allowAll, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { WishArDef } from '../wish.ar';
import { WishErrors } from '../wish.errors';
import { WishRules } from '../wish.rules';
import { WishModuleTargetVo } from '../wish.state';

/**
 * Желание пройти модуль — за вызывающего (`userId` — из субъекта, не из
 * входа), поэтому `allowAll` (см. `WishPolicy`). Порядок отказов — как
 * у legacy: сначала модуль (`moduleEnrollable`), затем дубль (`unique`).
 * Анкеты у модулей нет — желание сразу `expressed`; событий создания нет.
 */
export const CreateModuleWishUcDef = UseCaseDef.define({
  name: 'createModuleWish',
  label: 'Выразить желание пройти модуль',
  description:
    'Фиксирует желание пользователя пройти отдельный модуль опубликованного курса.',
  type: 'command',
  aggregate: WishArDef,
  callers: ['user'],
  policy: allowAll,
  rules: [WishRules.rules.moduleEnrollable, WishRules.rules.unique],
  calls: [GetModuleEnrollmentUcDef],
  input: v.object({ moduleId: WishModuleTargetVo.entries.moduleId }),
  output: v.object({}),
  errors: [WishErrors.MODULE_NOT_FOUND, WishErrors.ALREADY_EXISTS],
});

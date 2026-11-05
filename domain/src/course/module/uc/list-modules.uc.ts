import { allowAll, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { ModuleArDef, ModuleSummary } from '../module.ar';
import { ModuleState } from '../module.state';

const { entries } = ModuleState;

/**
 * Модули для показа: чтение открыто всем (`allowAll`), невидимые модули
 * молча отбрасываются. Выборка и сортировка — репозитория.
 */
export const ListModulesUcDef = UseCaseDef.define({
  name: 'listModules',
  label: 'Модули',
  description:
    'Список модулей с фильтрами по статусу, автору, названию и тегам — карточками без проектов.',
  type: 'query',
  aggregate: ModuleArDef,
  callers: ['user', 'guest'],
  policy: allowAll,
  input: v.object({
    status: v.pipe(
      v.optional(entries.status),
      v.description('Только модули в этом статусе'),
    ),
    authorId: v.pipe(
      v.optional(entries.authorId),
      v.description('Только модули этого автора'),
    ),
    title: v.pipe(
      v.optional(v.string()),
      v.description('Подстрока заголовка модуля без учёта регистра'),
    ),
    tags: v.pipe(
      v.optional(v.array(v.string())),
      v.description('Только модули хотя бы с одним из тегов'),
    ),
    sort: v.pipe(
      v.optional(v.string()),
      v.description('Порядок: `createdAt|title:asc|desc`'),
    ),
    limit: v.pipe(
      v.optional(v.pipe(v.number(), v.integer(), v.minValue(1))),
      v.description('Сколько модулей вернуть'),
    ),
  }),
  output: v.pipe(v.array(ModuleSummary), v.description('Модули')),
  errors: [],
});

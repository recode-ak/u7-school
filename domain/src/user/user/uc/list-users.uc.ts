import { allowAll, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { UserArDef, UserView } from '../user.ar';
import { UserRoleName, UserState } from '../user.state';

/** Поле и направление сортировки списка: `field:dir`. */
export const UserSort = v.picklist([
  'createdAt:asc',
  'createdAt:desc',
  'name:asc',
  'name:desc',
]);

/** Список пользователей с фильтрами; по умолчанию — 20 последних созданных. */
export const ListUsersUcDef = UseCaseDef.define({
  name: 'listUsers',
  label: 'Список пользователей',
  description:
    'Пользователи с фильтрами по роли, имени и telegramId, сортировкой и лимитом; по умолчанию — 20 последних созданных.',
  type: 'query',
  aggregate: UserArDef,
  callers: ['guest', 'user', 'system'],
  policy: allowAll,
  input: v.object({
    limit: v.optional(
      v.pipe(
        v.number(),
        v.integer(),
        v.minValue(1),
        v.description('Сколько пользователей вернуть'),
      ),
      20,
    ),
    role: v.optional(UserRoleName),
    name: v.optional(v.pipe(v.string(), v.description('Подстрока имени'))),
    telegramId: v.optional(UserState.entries.telegramId),
    sort: v.optional(
      v.pipe(UserSort, v.description('Поле и направление сортировки')),
      'createdAt:desc',
    ),
  }),
  output: v.array(UserView),
  errors: [],
});

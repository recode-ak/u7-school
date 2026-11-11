import { UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { UserArDef, UserView } from '../user.ar';
import { UserErrors } from '../user.errors';
import { UserPolicy } from '../user.policy';
import { UserRoleName, UserState } from '../user.state';

/**
 * Выдача роли: право — администратор (`canManageRoles`), порядок отказов
 * legacy сохранён — нет пользователя раньше нет права (ищет `load`).
 * Повторная выдача той же роли ничего не меняет.
 */
export const AddRoleToUserUcDef = UseCaseDef.define({
  name: 'addRoleToUser',
  label: 'Добавить роль пользователю',
  description:
    'Добавляет роль пользователю; роль уже есть — состояние не меняется.',
  type: 'command',
  aggregate: UserArDef,
  callers: ['user'],
  policy: UserPolicy.rules.canManageRoles,
  input: v.object({
    userId: UserState.entries.uuid,
    role: UserRoleName,
  }),
  output: UserView,
  errors: [UserErrors.NOT_FOUND],
});

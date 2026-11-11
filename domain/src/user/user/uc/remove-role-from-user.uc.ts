import { UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { UserArDef, UserView } from '../user.ar';
import { UserErrors } from '../user.errors';
import { UserPolicy } from '../user.policy';
import { UserRoleName, UserState } from '../user.state';

/**
 * Снятие роли: право — администратор (`canManageRoles`), нет пользователя —
 * отказ раньше права. Снятие последней роли оставляет `GUEST` (решение Ar);
 * роли нет — состояние не меняется.
 */
export const RemoveRoleFromUserUcDef = UseCaseDef.define({
  name: 'removeRoleFromUser',
  label: 'Снять роль у пользователя',
  description:
    'Снимает роль у пользователя; без ролей он остаётся гостем, отсутствующая роль состояние не меняет.',
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

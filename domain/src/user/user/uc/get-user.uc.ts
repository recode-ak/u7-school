import { allowAll, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { UserArDef, UserView } from '../user.ar';
import { UserErrors } from '../user.errors';
import { UserState } from '../user.state';

/**
 * Профиль пользователя по UUID — для UI и других модулей. Чтение legacy было
 * открыто всем, поэтому `callers` — гость и пользователь; `system` — резолвер
 * `Caller`. Нет пользователя — `USER_NOT_FOUND` из `load`.
 */
export const GetUserUcDef = UseCaseDef.define({
  name: 'getUser',
  label: 'Получить пользователя',
  description:
    'Профиль пользователя по UUID; нет пользователя — USER_NOT_FOUND.',
  type: 'query',
  aggregate: UserArDef,
  callers: ['guest', 'user', 'system'],
  policy: allowAll,
  input: v.object({ uuid: UserState.entries.uuid }),
  output: UserView,
  errors: [UserErrors.NOT_FOUND],
});

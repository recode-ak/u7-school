import { allowAll, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { UserArDef, UserView } from '../user.ar';
import { UserState } from '../user.state';

/** Максимум идентификаторов в одном пакетном запросе. */
const GET_USERS_BY_IDS_MAX = 100;

/**
 * Пакет профилей по списку uuid — для карточек UI и системных проактивов
 * (приглашения peer-review резолвят профили без актора, поэтому `system` и
 * `guest` в `callers`). Порог входа — 100 идентификаторов.
 */
export const GetUsersByIdsUcDef = UseCaseDef.define({
  name: 'getUsersByIds',
  label: 'Пользователи по списку UUID',
  description:
    'Профили пользователей одним запросом; ненайденные пропускаются, порядок — как во входе.',
  type: 'query',
  aggregate: UserArDef,
  callers: ['guest', 'user', 'system'],
  policy: allowAll,
  input: v.object({
    userIds: v.pipe(
      v.array(UserState.entries.uuid),
      v.maxLength(GET_USERS_BY_IDS_MAX, 'Не более 100 пользователей за запрос'),
      v.description('Пользователи, чьи профили нужны'),
    ),
  }),
  output: v.array(UserView),
  errors: [],
});

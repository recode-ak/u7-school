import * as v from 'valibot';
import { ErrorDef } from '#core/kernel/errors/error-def';
import { F } from '#core/kernel/fields/fields';

export const UserErrors = ErrorDef.define('USER', {
  NOT_FOUND: {
    kind: 'not_found',
    label: 'Пользователь не найден',
    description: 'Пользователя с таким идентификатором нет.',
    payload: v.object({ userId: F.uuid('пользователя') }),
  },
  ALREADY_REMOVED: {
    kind: 'conflict',
    label: 'Пользователь уже удалён',
    description: 'Удалённую учётную запись нельзя удалить повторно.',
  },
});

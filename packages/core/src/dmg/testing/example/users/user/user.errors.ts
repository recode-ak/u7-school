import * as v from 'valibot';
import { defineErrors } from '#dmg/kernel/errors/define-errors';
import { F } from '#dmg/kernel/fields/fields';

export const UserErrors = defineErrors('USER', {
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

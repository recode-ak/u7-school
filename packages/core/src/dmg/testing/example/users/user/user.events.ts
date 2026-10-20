import * as v from 'valibot';
import { defineEvents } from '#dmg/domain/events/define-events';
import { F } from '#dmg/kernel/fields/fields';

export const UserEvents = defineEvents('users.user', {
  removed: {
    label: 'Пользователь удалён',
    description: 'Учётная запись пользователя удалена.',
    payload: v.object({ userId: F.uuid('пользователя') }),
  },
});

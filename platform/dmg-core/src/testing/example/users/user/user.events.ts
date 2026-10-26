import * as v from 'valibot';
import { EventDef } from '#core/domain/events/event-def';
import { F } from '#core/kernel/fields/fields';

export const UserEvents = EventDef.define('users.user', {
  removed: {
    label: 'Пользователь удалён',
    description: 'Учётная запись пользователя удалена.',
    payload: v.object({ userId: F.uuid('пользователя') }),
  },
});

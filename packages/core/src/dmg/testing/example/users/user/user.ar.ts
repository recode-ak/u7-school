import * as v from 'valibot';
import { defineAggregate } from '../../../../domain/aggregate/define-aggregate';
import { defineEvents } from '../../../../domain/events/define-events';
import { BaseEntityFields } from '../../../../kernel/fields/fields';

// Заглушка чужого модуля для учебного `todo`: только Def, без реализации.

export const UserEvents = defineEvents('users.user', {
  removed: {
    label: 'Пользователь удалён',
    description: 'Учётная запись пользователя удалена.',
    payload: v.object({ userId: v.string() }),
  },
});

export const UserArDef = defineAggregate({
  name: 'user',
  label: 'Пользователь',
  description: 'Учётная запись.',
  state: v.object({ ...BaseEntityFields }),
  events: UserEvents,
  errors: {},
});

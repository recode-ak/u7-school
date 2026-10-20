import {
  Aggregate,
  type ErrorsOf,
  type EventsOf,
} from '#core/domain/aggregate/aggregate';
import { defineAggregate } from '#core/domain/aggregate/define-aggregate';
import { ok, type Result } from '#core/kernel/result/result';
import type { Timestamp } from '#core/kernel/time/timestamp';
import { UserErrors } from './user.errors';
import { UserEvents } from './user.events';
import { UserState } from './user.state';

// Минимальный второй модуль учебного примера: источник события, на которое
// реагирует `todo`.

export const UserArDef = defineAggregate({
  name: 'user',
  label: 'Пользователь',
  description: 'Учётная запись: активна, пока её не удалят.',
  state: UserState,
  statuses: {
    active: { label: 'Активна' },
    removed: { label: 'Удалена' },
  },
  transitions: {
    remove: {
      from: ['active'],
      to: 'removed',
      rejects: { removed: UserErrors.ALREADY_REMOVED },
    },
  },
  events: UserEvents,
  errors: UserErrors,
});

type UserError = ErrorsOf<typeof UserArDef>;
type UserEvent = EventsOf<typeof UserArDef>;

export class UserAr extends Aggregate<typeof UserArDef> {
  private constructor(state: UserState, events?: readonly UserEvent[]) {
    super(UserArDef, state, events);
  }

  static restore(snapshot: UserState): UserAr {
    return new UserAr(snapshot);
  }

  remove(at: Timestamp): Result<void, UserError> {
    return this.transition('remove', at, (_, emit) => {
      emit(UserEvents.removed.make({ userId: this.uuid }));
      return ok();
    });
  }
}

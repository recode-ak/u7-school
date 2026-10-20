import {
  Aggregate,
  defineAggregate,
  type ErrorsOf,
  newEntity,
  ok,
  type RejectOf,
  type Result,
  type Timestamp,
  type TransitionOf,
} from 'dmg-core';
import { WishErrors } from './wish.errors';
import { WishEvents } from './wish.events';
import { WishState, type WishStatus, type WishTargetVo } from './wish.state';

const { NOT_CONFIRMABLE, NOT_ABANDONABLE, NOT_CANCELLABLE, NOT_FULFILLABLE } =
  WishErrors;

export const WishArDef = defineAggregate({
  name: 'wish',
  label: 'Желание',
  description:
    'Желание пользователя пройти курс или модуль: фиксируется сразу или после анкеты, затем отменяется или реализуется зачислением на поток.',
  state: WishState,
  statuses: {
    expressed: { label: 'Выражено' },
    pending: { label: 'Ожидает анкету' },
    confirmed: { label: 'Подтверждено' },
    cancelled: { label: 'Отменено' },
    abandoned: { label: 'Анкета брошена' },
    fulfilled: { label: 'Реализовано' },
  },
  transitions: {
    confirm: {
      from: ['pending'],
      to: 'confirmed',
      rejects: {
        expressed: NOT_CONFIRMABLE,
        confirmed: NOT_CONFIRMABLE,
        cancelled: NOT_CONFIRMABLE,
        abandoned: NOT_CONFIRMABLE,
        fulfilled: NOT_CONFIRMABLE,
      },
    },
    abandon: {
      from: ['pending'],
      to: 'abandoned',
      rejects: {
        expressed: NOT_ABANDONABLE,
        confirmed: NOT_ABANDONABLE,
        cancelled: NOT_ABANDONABLE,
        abandoned: NOT_ABANDONABLE,
        fulfilled: NOT_ABANDONABLE,
      },
    },
    cancel: {
      from: ['expressed', 'confirmed'],
      to: 'cancelled',
      rejects: {
        pending: NOT_CANCELLABLE,
        cancelled: NOT_CANCELLABLE,
        abandoned: NOT_CANCELLABLE,
        fulfilled: NOT_CANCELLABLE,
      },
    },
    fulfill: {
      from: ['expressed', 'confirmed'],
      to: 'fulfilled',
      rejects: {
        pending: NOT_FULFILLABLE,
        cancelled: NOT_FULFILLABLE,
        abandoned: NOT_FULFILLABLE,
        fulfilled: NOT_FULFILLABLE,
      },
    },
  },
  events: WishEvents,
  errors: WishErrors,
});

export type WishError = ErrorsOf<typeof WishArDef>;
type WishTransition = TransitionOf<typeof WishArDef>;

/**
 * Вход создания: начальный статус выбирает UC — `pending`, если у цели
 * есть пул анкеты, иначе `expressed`.
 */
export type CreateWish = {
  readonly uuid: string;
  readonly userId: string;
  readonly target: WishTargetVo;
  readonly status: Extract<WishStatus, 'expressed' | 'pending'>;
};

/**
 * Агрегат Wish — желание пользователя в отношении цели (target).
 *
 * Жизненный цикл (правила — в `WishArDef.transitions`), две ветки:
 * - мгновенная: expressed → cancelled | fulfilled;
 * - анкетная: pending → confirmed | abandoned, далее confirmed → cancelled | fulfilled.
 *
 * Инвариант «не более одного активного желания на пару (user, target)»
 * охватывает несколько агрегатов — его проверяет UC при создании.
 */
export class WishAr extends Aggregate<typeof WishArDef> {
  private constructor(state: WishState) {
    super(WishArDef, state);
  }

  static create(input: CreateWish, at: Timestamp): Result<WishAr, never> {
    const state: WishState = {
      ...newEntity(input.uuid, at),
      userId: input.userId,
      target: input.target,
      status: input.status,
    };
    return ok(new WishAr(state));
  }

  /** Восстановление из хранилища — запись разобрана `WishArDef.state`. */
  static restore(snapshot: WishState): WishAr {
    return new WishAr(snapshot);
  }

  // ── Предикаты переходов ──
  // Отвечают по `from` в Def: ER спрашивают их ради идемпотентности,
  // не читая статус напрямую.

  /** Подтверждаемо ли желание (только pending — анкетная ветка). */
  canConfirm(): boolean {
    return this.can('confirm');
  }

  /** Бросаемо ли желание (только pending — анкета прервана). */
  canAbandon(): boolean {
    return this.can('abandon');
  }

  /** Отменяемо ли желание (expressed | confirmed). */
  canCancel(): boolean {
    return this.can('cancel');
  }

  /** Реализуемо ли желание (expressed | confirmed — зачисление на поток). */
  canFulfill(): boolean {
    return this.can('fulfill');
  }

  // ── Переходы ──

  /** Подтверждает желание: pending → confirmed (анкета завершена). */
  confirm(at: Timestamp): Result<void, RejectOf<typeof WishArDef, 'confirm'>> {
    return this.transition('confirm', at, () => ok());
  }

  /** Помечает желание брошенным: pending → abandoned (анкета брошена). */
  abandon(at: Timestamp): Result<void, RejectOf<typeof WishArDef, 'abandon'>> {
    return this.transition('abandon', at, () => ok());
  }

  /** Отменяет желание: expressed | confirmed → cancelled. */
  cancel(at: Timestamp): Result<void, RejectOf<typeof WishArDef, 'cancel'>> {
    return this.transition('cancel', at, () => ok());
  }

  /**
   * Реализует желание: expressed | confirmed → fulfilled
   * (студент зачислен на поток курса — событие student.enrolled).
   */
  fulfill(at: Timestamp): Result<void, RejectOf<typeof WishArDef, 'fulfill'>> {
    return this.transition('fulfill', at, () => ok());
  }

  private can(op: WishTransition): boolean {
    const from: readonly WishStatus[] = WishArDef.transitions[op].from;
    return from.includes(this.state.status);
  }
}

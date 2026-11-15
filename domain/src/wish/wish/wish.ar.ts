import type { QuestionnairePool } from '@u7-scl/domain/questionnaire/contract';
import {
  Aggregate,
  AggregateDef,
  type ErrorOf,
  type ErrorsOf,
  ok,
  type RejectOf,
  type Result,
  type Timestamp,
  type TransitionOf,
} from 'dmg-core';
import { findCoursePool } from './pools/course-pool';
import { WishErrors, WishPairErrors } from './wish.errors';
import { WishEvents } from './wish.events';
import { WishState, type WishStatus, type WishTargetVo } from './wish.state';
import type { FulfillmentTargets } from './wish.types';
import { WishQuestionnaireOwner } from './wish-questionnaire-owner';

const {
  NOT_CONFIRMABLE,
  NOT_ABANDONABLE,
  NOT_CANCELLABLE,
  NOT_FULFILLABLE,
  NOT_INVITABLE,
  ALREADY_INVITED,
  ALREADY_EXISTS,
  NOT_FOUND,
} = WishErrors;

export const WishArDef = AggregateDef.define({
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
 * Активные статусы — желание ещё в работе и занимает цель: второе активное
 * на ту же пару (user, target) не создаётся (`WishRules.rules.unique`).
 */
const ACTIVE_STATUSES: readonly (keyof typeof WishArDef.statuses)[] = [
  'expressed',
  'pending',
  'confirmed',
];

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

/** Вход создания желания на курс: начальный статус выбирает Ar. */
export type CreateCourseWish = {
  readonly uuid: string;
  readonly userId: string;
  readonly courseId: string;
};

/** Вход создания желания на модуль: статус — `expressed`, решает Ar. */
export type CreateModuleWish = {
  readonly uuid: string;
  readonly userId: string;
  readonly moduleId: string;
};

/**
 * Анкета к запуску для нового желания: вход UC запуска анкеты (D-42).
 * `ownerInfo` модуль анкет не толкует и возвращает в событиях — по `courseId`
 * реакции желаний находят желание.
 */
export type WishQuestionnaire = {
  readonly pool: QuestionnairePool;
  readonly owner: { readonly courseId: string };
};

/**
 * Агрегат Wish — желание пользователя в отношении цели (target).
 *
 * Жизненный цикл (правила — в `WishArDef.transitions`), две ветки:
 * - мгновенная: expressed → cancelled | fulfilled;
 * - анкетная: pending → confirmed | abandoned, далее confirmed → cancelled | fulfilled.
 *
 * Инвариант «не более одного активного желания на пару (user, target)»
 * охватывает несколько агрегатов — его проверяет доменное правило
 * `WishRules.rules.unique` (D-40).
 */
export class WishAr extends Aggregate<typeof WishArDef> {
  private constructor(state: WishState) {
    super(WishArDef, state);
  }

  static create(input: CreateWish, at: Timestamp): Result<WishAr, never> {
    const state: WishState = {
      ...WishAr.newState(input.uuid, at),
      userId: input.userId,
      target: input.target,
      status: input.status,
    };
    return ok(new WishAr(state));
  }

  /**
   * Желание пройти курс. Ветку выбирает пул анкеты курса (доменные данные
   * модуля): пул есть — `pending` (анкета — `questionnaire()`), нет —
   * `expressed` (мгновенная фиксация).
   */
  static createForCourse(
    input: CreateCourseWish,
    at: Timestamp,
  ): Result<WishAr, never> {
    const { uuid, userId, courseId } = input;
    return ok(
      new WishAr({
        ...WishAr.newState(uuid, at),
        userId,
        target: { kind: 'course', courseId },
        status: findCoursePool(courseId) ? 'pending' : 'expressed',
      }),
    );
  }

  /**
   * Желание пройти модуль: всегда `expressed` — анкеты у модулей нет
   * (студент уже верифицирован).
   */
  static createForModule(
    input: CreateModuleWish,
    at: Timestamp,
  ): Result<WishAr, never> {
    const { uuid, userId, moduleId } = input;
    return ok(
      new WishAr({
        ...WishAr.newState(uuid, at),
        userId,
        target: { kind: 'module', moduleId },
        status: 'expressed',
      }),
    );
  }

  /** Восстановление из хранилища — запись разобрана `WishArDef.state`. */
  static restore(snapshot: WishState): WishAr {
    return new WishAr(snapshot);
  }

  // ── Вопросы ──

  /** Активно ли желание (expressed | pending | confirmed) — занимает ли цель. */
  isActive(): boolean {
    return ACTIVE_STATUSES.includes(this.state.status);
  }

  /** Создано ли желание позже другого — порядок для `WishSelectionDqs.latest`. */
  isCreatedAfter(other: Pick<WishAr, 'view'>): boolean {
    return this.state.createdAt > other.view().createdAt;
  }

  /** Принадлежит ли желание пользователю. */
  isOwnedBy(userId: string): boolean {
    return this.state.userId === userId;
  }

  /** Желание на эту цель (тот же курс или тот же модуль). */
  isFor(target: CreateWish['target']): boolean {
    const mine = this.state.target;
    if (target.kind === 'course') {
      return mine.kind === 'course' && mine.courseId === target.courseId;
    }
    return mine.kind === 'module' && mine.moduleId === target.moduleId;
  }

  /**
   * Ошибка «желание уже выражено» от лица этого (существующего активного)
   * желания: цель и статус берутся из своего state — Ar владеет ошибками
   * своей группы, статус наружу не отдаётся (D-39).
   * Возвращает значение ошибки, а не `Result`: метод не мутирует и должен
   * остаться в `ReadonlyAr` (там вырезаются методы, возвращающие `Result`).
   */
  alreadyExists(): ErrorOf<typeof ALREADY_EXISTS> {
    const { userId, target, status } = this.state;
    return new WishPairErrors(userId, target).alreadyExists(status);
  }

  /**
   * Ошибка «желание не найдено» от лица этого желания: для вызывающего
   * неотменяемое/нереализуемое желание неотличимо от отсутствующего
   * (сохраняемое поведение legacy). Цель и пользователь — из своего state,
   * статус наружу не отдаётся (D-39). Значение ошибки, не `Result` — метод
   * остаётся в `ReadonlyAr`.
   */
  notFound(): ErrorOf<typeof NOT_FOUND> {
    const { userId, target } = this.state;
    return new WishPairErrors(userId, target).notFound();
  }

  /**
   * Анкета к запуску: у `pending`-желания на курс с пулом — пул и `owner`
   * (`courseId` вернётся в событиях анкеты), иначе `undefined`. Выводится из
   * state, не хранится.
   */
  questionnaire(): WishQuestionnaire | undefined {
    const { status, target } = this.state;
    if (status !== 'pending' || target.kind !== 'course') return undefined;
    const pool = findCoursePool(target.courseId);
    if (!pool) return undefined;
    return {
      pool,
      owner: WishQuestionnaireOwner.forCourse(target.courseId).info(),
    };
  }

  /** Исход создания для вызывающего: `questionnaire`, если нужна анкета. */
  outcome(): 'instant' | 'questionnaire' {
    return this.questionnaire() ? 'questionnaire' : 'instant';
  }

  /**
   * О чём спросить модуль курсов при зачислении: реализуемое желание —
   * о своей цели (курс или модуль), остальные — ни о чём. Выводится из
   * state; батч по желаниям собирает `WishFulfillmentDcs`.
   */
  fulfillmentTargets(): FulfillmentTargets {
    if (!this.canFulfill()) return { courseIds: [], moduleIds: [] };
    const { target } = this.state;
    return target.kind === 'course'
      ? { courseIds: [target.courseId], moduleIds: [] }
      : { courseIds: [], moduleIds: [target.moduleId] };
  }

  /**
   * Реализует ли зачисление желание: оно реализуемо, и его цель среди
   * целей, которые модуль курсов признал за модулем потока (`enrolled`).
   * Нереализуемое — нет: повторное событие ничего не меняет.
   */
  isFulfilledBy(enrolled: FulfillmentTargets): boolean {
    if (!this.canFulfill()) return false;
    const { target } = this.state;
    return target.kind === 'course'
      ? enrolled.courseIds.includes(target.courseId)
      : enrolled.moduleIds.includes(target.moduleId);
  }

  /**
   * О чём спросить модуль курсов при открытии набора: приглашаемое желание —
   * о своей цели (курс или модуль), остальные — ни о чём. Выводится из
   * state; батч по желаниям собирает `WishInvitationDcs`.
   */
  invitationTargets(): FulfillmentTargets {
    if (!this.canInvite()) return { courseIds: [], moduleIds: [] };
    const { target } = this.state;
    return target.kind === 'course'
      ? { courseIds: [target.courseId], moduleIds: [] }
      : { courseIds: [], moduleIds: [target.moduleId] };
  }

  /** Кому адресовано приглашение: пользователь-желающий. */
  addresseeId(): string {
    return this.state.userId;
  }

  /** Приглашён ли желающий на этот поток. */
  wasInvitedTo(streamId: string): boolean {
    return this.state.invitedStreamIds?.includes(streamId) ?? false;
  }

  /**
   * Приглашает ли набор желание: оно приглашаемо, и его цель среди целей,
   * которые модуль курсов признал за модулем потока (`matched`).
   */
  isInvitedBy(matched: FulfillmentTargets): boolean {
    if (!this.canInvite()) return false;
    const { target } = this.state;
    return target.kind === 'course'
      ? matched.courseIds.includes(target.courseId)
      : matched.moduleIds.includes(target.moduleId);
  }

  // ── Предикаты переходов ──
  // Отвечают по `from` в Def: ER спрашивают их ради идемпотентности,
  // не читая статус напрямую.

  /** Подтверждаемо ли желание (только pending курса — анкетная ветка). */
  canConfirm(): boolean {
    return this.can('confirm') && this.confirmableCourseId() !== undefined;
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

  /** Приглашаемо ли желание (expressed | confirmed — ждёт набора). */
  canInvite(): boolean {
    return (
      this.state.status === 'expressed' || this.state.status === 'confirmed'
    );
  }

  // ── Переходы ──

  /**
   * Подтверждает желание: pending → confirmed (анкета завершена),
   * событие `confirmed`.
   */
  confirm(at: Timestamp): Result<void, RejectOf<typeof WishArDef, 'confirm'>> {
    // Анкетная ветка — только у курса (пулы анкет курсовые): `confirmed`
    // адресует менторов курса, у module-желания подтверждать нечего.
    const courseId = this.confirmableCourseId();
    if (courseId === undefined) return NOT_CONFIRMABLE.err();
    return this.transition('confirm', at, (draft, emit) => {
      emit(WishEvents.confirmed.make({ userId: draft.userId, courseId }));
      return ok();
    });
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

  /**
   * Приглашает желающего на поток: событие `invited` с адресом и целью из
   * своего state, поток запоминается в `invitedStreamIds`. Статус не меняется.
   * Не приглашаемое — `NOT_INVITABLE`, уже приглашённое на этот поток —
   * `ALREADY_INVITED`.
   */
  invite(
    at: Timestamp,
    to: { readonly streamId: string; readonly telegramId: number },
  ): Result<
    void,
    ErrorOf<typeof NOT_INVITABLE> | ErrorOf<typeof ALREADY_INVITED>
  > {
    if (!this.canInvite()) return NOT_INVITABLE.err();
    if (this.wasInvitedTo(to.streamId)) return ALREADY_INVITED.err();
    return this.change(at, (draft, emit) => {
      const { userId, target } = draft;
      const addressee = { userId, ...to };
      draft.invitedStreamIds = [...(draft.invitedStreamIds ?? []), to.streamId];
      emit(
        WishEvents.invited.make(
          target.kind === 'course'
            ? { ...addressee, targetKind: 'course', courseId: target.courseId }
            : { ...addressee, targetKind: 'module', moduleId: target.moduleId },
        ),
      );
      return ok();
    });
  }

  /** Единственное место правила: подтверждать можно только course-желание. */
  private confirmableCourseId(): string | undefined {
    const { target } = this.state;
    return target.kind === 'course' ? target.courseId : undefined;
  }

  private can(op: WishTransition): boolean {
    const from: readonly WishStatus[] = WishArDef.transitions[op].from;
    return from.includes(this.state.status);
  }
}

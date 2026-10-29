import {
  Aggregate,
  AggregateDef,
  type ErrorsOf,
  type EventsOf,
  ok,
  type Result,
  type Timestamp,
} from 'dmg-core';
import type { StudentOutcome } from '../shared/campaign-fields';
import { ReviewErrors } from './review.errors';
import { ReviewEvents } from './review.events';
import { type ReviewDirection, ReviewState } from './review.state';

/**
 * Агрегат без жизненного цикла: отзыв только создаётся и перезаписывается
 * (текст), статуса нет.
 */
export const ReviewArDef = AggregateDef.define({
  name: 'review',
  label: 'Отзыв',
  description:
    'Текстовый отзыв одного участника кампании о другом: пара (кампания, автор, адресат) уникальна, повтор перезаписывает текст.',
  state: ReviewState,
  events: ReviewEvents,
  errors: ReviewErrors,
});

export type ReviewError = ErrorsOf<typeof ReviewArDef>;

/** Вход создания отзыва: направление и снимок исхода автора даёт `ReviewDraftDqs`. */
export type CreateReview = {
  readonly uuid: string;
  readonly campaignId: string;
  /** Скоуп кампании — денормализация для выборок по скоупу. */
  readonly scopeId: string;
  readonly authorId: string;
  readonly direction: ReviewDirection;
  /** Снимок исхода автора-студента; у ментора его нет. */
  readonly authorOutcome?: StudentOutcome;
  readonly recipientId: string;
  readonly text: string;
};

/**
 * Агрегат Review — отзыв участника кампании. Допустимость текста, окна и
 * адресата проверяют правила UC (`ReviewRules`); схема state страхует
 * восстановление из хранилища.
 */
export class ReviewAr extends Aggregate<typeof ReviewArDef> {
  private constructor(
    state: ReviewState,
    events: readonly EventsOf<typeof ReviewArDef>[] = [],
  ) {
    super(ReviewArDef, state, events);
  }

  /** Создаёт отзыв в момент `at`; событие `created` — только здесь. */
  static create(input: CreateReview, at: Timestamp): Result<ReviewAr, never> {
    const state: ReviewState = {
      ...ReviewAr.newState(input.uuid, at),
      scopeId: input.scopeId,
      campaignId: input.campaignId,
      authorId: input.authorId,
      direction: input.direction,
      ...(input.authorOutcome !== undefined
        ? { authorOutcome: input.authorOutcome }
        : {}),
      recipientId: input.recipientId,
      text: input.text,
    };
    const created = ReviewEvents.created.make({
      reviewId: input.uuid,
      campaignId: input.campaignId,
      scopeId: input.scopeId,
      authorId: input.authorId,
      recipientId: input.recipientId,
      direction: input.direction,
    });
    return ok(new ReviewAr(state, [created]));
  }

  /** Восстановление из хранилища — запись разобрана `ReviewArDef.state`. */
  static restore(snapshot: ReviewState): ReviewAr {
    return new ReviewAr(snapshot);
  }

  /** Перезаписывает текст в момент `at`; события нет (окно проверяет UC). */
  overwrite(text: string, at: Timestamp): Result<void, never> {
    return this.change(at, (draft) => {
      draft.text = text;
      return ok();
    });
  }

  // ── Вопросы ──

  get campaignId(): string {
    return this.state.campaignId;
  }

  get scopeId(): string {
    return this.state.scopeId;
  }

  get authorId(): string {
    return this.state.authorId;
  }

  get recipientId(): string {
    return this.state.recipientId;
  }

  get direction(): ReviewDirection {
    return this.state.direction;
  }

  /** Снимок исхода автора-студента; у ментора — `undefined`. */
  get authorOutcome(): StudentOutcome | undefined {
    return this.state.authorOutcome;
  }

  get text(): string {
    return this.state.text;
  }
}

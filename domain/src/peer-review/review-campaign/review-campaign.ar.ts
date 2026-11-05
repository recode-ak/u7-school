import {
  Aggregate,
  AggregateDef,
  type ErrorsOf,
  type EventsOf,
  ok,
  type Result,
  type Timestamp,
} from 'dmg-core';
import * as v from 'valibot';
import type {
  CampaignAuthorRole,
  StudentOutcome,
} from '../shared/campaign-fields';
import { REVIEW_WINDOW_DAYS } from './constants';
import { ReviewCampaignErrors } from './review-campaign.errors';
import { ReviewCampaignEvents } from './review-campaign.events';
import { ReviewCampaignState } from './review-campaign.state';

const { INVALID_PARTICIPANTS } = ReviewCampaignErrors;

/** Миллисекунд в сутках — для окна и остатка дней. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Агрегат без жизненного цикла: окно закрывается временем (`expiresAt`),
 * статус `expired` не хранится.
 */
export const ReviewCampaignArDef = AggregateDef.define({
  name: 'review-campaign',
  label: 'Кампания отзывов',
  description:
    'Окно сбора отзывов о судьбе студента потока: субъект и ментор пишут соученикам и друг другу, пока окно не закроется по времени.',
  state: ReviewCampaignState,
  events: ReviewCampaignEvents,
  errors: ReviewCampaignErrors,
});

export type ReviewCampaignError = ErrorsOf<typeof ReviewCampaignArDef>;

/** Вход создания кампании окна судьбы студента (событие потока → ER). */
export type CreateReviewCampaign = {
  readonly uuid: string;
  readonly scopeId: string;
  readonly subjectId: string;
  readonly mentorId: string;
  readonly subjectOutcome: StudentOutcome;
  readonly participantIds: readonly string[];
};

type Violation = {
  readonly reason: 'duplicate' | 'subject' | 'mentor';
  readonly userId: string;
};

/**
 * Инварианты адресации окна судьбы (ФР-3): участники уникальны; субъект не
 * адресует отзыв сам себе — его нет среди участников; ментор — не соученик.
 */
function addressingViolation(
  subjectId: string,
  mentorId: string,
  participants: readonly string[],
): Violation | undefined {
  const seen = new Set<string>();
  for (const userId of participants) {
    if (seen.has(userId)) return { reason: 'duplicate', userId };
    seen.add(userId);
  }
  if (seen.has(subjectId)) return { reason: 'subject', userId: subjectId };
  if (seen.has(mentorId)) return { reason: 'mentor', userId: mentorId };
  return undefined;
}

/** Инвариант адресации как схема — им проверяется запись при `restore`. */
const AddressingInvariant = v.pipe(
  v.object({
    subjectId: v.string(),
    mentorId: v.string(),
    participants: v.array(v.string()),
  }),
  v.check(
    ({ subjectId, mentorId, participants }) =>
      addressingViolation(subjectId, mentorId, participants) === undefined,
    'Кампания: участники не уникальны либо среди них субъект или ментор',
  ),
);

/**
 * Агрегат ReviewCampaign — кампания сбора отзывов (контекст `stream_fate`).
 *
 * Адресаты: субъект → участники + ментор; ментор → только субъект; участник и
 * посторонний — не авторы окна. Окно живёт `REVIEW_WINDOW_DAYS` суток от
 * момента создания; граница включительно (`at >= expiresAt` — закрыто).
 * Направление и допустимость рецензии вычисляет срез `review`.
 */
export class ReviewCampaignAr extends Aggregate<typeof ReviewCampaignArDef> {
  private constructor(
    state: ReviewCampaignState,
    events: readonly EventsOf<typeof ReviewCampaignArDef>[] = [],
  ) {
    super(ReviewCampaignArDef, state, events);
    // Нарушение инварианта хранилища (не штатный отказ): parse бросает.
    v.parse(AddressingInvariant, {
      subjectId: state.subjectId,
      mentorId: state.payload.mentorId,
      participants: state.participants,
    });
  }

  /**
   * Создаёт кампанию окна судьбы: окно — `at` + 7 суток, событие `created`.
   * Нарушение адресации — отказ `INVALID_PARTICIPANTS`, не исключение.
   */
  static create(
    input: CreateReviewCampaign,
    at: Timestamp,
  ): Result<ReviewCampaignAr, ErrorsOf<typeof ReviewCampaignArDef>> {
    const { uuid, scopeId, subjectId, mentorId, subjectOutcome } = input;
    const violation = addressingViolation(
      subjectId,
      mentorId,
      input.participantIds,
    );
    if (violation) return INVALID_PARTICIPANTS.err(violation);
    const state: ReviewCampaignState = {
      ...ReviewCampaignAr.newState(uuid, at),
      context: 'stream_fate',
      scopeId,
      subjectId,
      expiresAt: at + REVIEW_WINDOW_DAYS.streamFate * DAY_MS,
      participants: [...input.participantIds],
      payload: { subjectOutcome, mentorId },
    };
    const created = ReviewCampaignEvents.created.make({
      campaignId: uuid,
      context: 'stream_fate',
      scopeId,
      subjectId,
      mentorId,
      subjectOutcome,
    });
    return ok(new ReviewCampaignAr(state, [created]));
  }

  /** Восстановление из хранилища — запись разобрана `ReviewCampaignArDef.state`. */
  static restore(snapshot: ReviewCampaignState): ReviewCampaignAr {
    return new ReviewCampaignAr(snapshot);
  }

  // ── Вопросы: каркас и payload ──

  /** uuid скоупа кампании (для stream_fate — streamId). */
  get scopeId(): string {
    return this.state.scopeId;
  }

  /** uuid студента, чьё событие открыло окно судьбы. */
  get subjectId(): string {
    return this.state.subjectId;
  }

  /** uuid ментора скоупа — второй автор окна. */
  get mentorId(): string {
    return this.state.payload.mentorId;
  }

  /** Исход судьбы субъекта — 4-значная проекция. */
  get subjectOutcome(): StudentOutcome {
    return this.state.payload.subjectOutcome;
  }

  /** Момент закрытия окна (мс, UTC). */
  get expiresAt(): Timestamp {
    return this.state.expiresAt;
  }

  /** Кампания именно этой пары (скоуп, субъект) — для правила уникальности. */
  isFor(scopeId: string, subjectId: string): boolean {
    return this.state.scopeId === scopeId && this.state.subjectId === subjectId;
  }

  isSubject(userId: string): boolean {
    return this.state.subjectId === userId;
  }

  isMentor(userId: string): boolean {
    return this.state.payload.mentorId === userId;
  }

  // ── Вопросы: окно жизни ──

  /** Закрыто ли окно на момент `at` (граница включительно). */
  isExpired(at: Timestamp): boolean {
    return at >= this.state.expiresAt;
  }

  /**
   * Остаток окна в полных отображаемых днях (округление вверх):
   * меньше суток до конца — 1, истёкшее — 0.
   */
  daysLeft(at: Timestamp): number {
    if (this.isExpired(at)) return 0;
    return Math.max(1, Math.ceil((this.state.expiresAt - at) / DAY_MS));
  }

  // ── Вопросы: авторство и адресация ──

  /** Роль автора окна; соученик и посторонний — не авторы. */
  authorRoleOf(userId: string): CampaignAuthorRole | undefined {
    if (this.isSubject(userId)) return 'subject';
    if (this.isMentor(userId)) return 'mentor';
    return undefined;
  }

  /**
   * Адресаты автора: субъект → участники + ментор (порядок сохранён);
   * ментор → субъект; не автор окна — никого.
   */
  targetIdsFor(userId: string): string[] {
    const role = this.authorRoleOf(userId);
    if (role === 'subject') {
      return [...this.state.participants, this.state.payload.mentorId];
    }
    if (role === 'mentor') return [this.state.subjectId];
    return [];
  }
}

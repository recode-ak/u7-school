import { U7UseCase } from '@u7-scl/app-legacy/domain';
import { errAccessDenied, errConflict, errNotFound } from '@u7-scl/core/domain';
import { now } from '@u7-scl/core/shared';
import type {
  CampaignNotFoundUcError,
  PeerReviewApiModuleResolver,
  PeerReviewNotParticipantUcError,
  RecipientNotAllowedUcError,
  Review,
  ReviewCampaignAr,
  ReviewDirection,
  ReviewWindowClosedUcError,
  StudentOutcome,
} from '@u7-scl/domain/peer-review';
import {
  type CreateReviewCmd,
  type CreateReviewCmdMeta,
  CreateReviewCmdSchema,
  ReviewAr,
  ReviewSavedSchema,
} from '@u7-scl/domain/peer-review';

/**
 * Создание/перезапись отзыва (ФР-7). TR (мост до среза `review`, Ф2): окно и
 * права проверяются вопросами нового `ReviewCampaignAr`, отказ бросается
 * прежними legacy-кодами; UC добывает данные и сохраняет результат.
 */
export class CreateReviewUc extends U7UseCase<
  CreateReviewCmdMeta,
  PeerReviewApiModuleResolver
> {
  protected readonly ucName = 'create-review' as const;
  protected readonly ucLabel = 'Написать отзыв' as const;
  protected readonly arMeta = {
    arName: 'Review' as const,
    arLabel: 'Отзыв' as const,
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = CreateReviewCmdSchema;
  protected readonly outputSchema = ReviewSavedSchema;

  async execute(
    command: CreateReviewCmd,
  ): Promise<CreateReviewCmdMeta['output']> {
    const ar = await this.resolve.reviewCampaignRepo.findById(
      command.campaignId,
    );
    if (!ar) {
      this.throwError(
        errNotFound<CampaignNotFoundUcError>(
          'PEER_REVIEW_CAMPAIGN_NOT_FOUND',
          'Кампания отзывов не найдена',
          { campaignId: command.campaignId },
        ) as CreateReviewCmdMeta['errors'],
      );
    }
    this.ensureLive(ar);
    const { direction, authorOutcome } = this.assertCanWrite(
      ar,
      command.authorId,
      command.recipientId,
    );

    const existing = await this.resolve.reviewRepo.findByPair(
      command.campaignId,
      command.authorId,
      command.recipientId,
    );
    const review = existing
      ? this.overwrite(existing, command.text)
      : ReviewAr.create({
          campaignId: command.campaignId,
          scopeId: ar.scopeId,
          authorId: command.authorId,
          direction,
          ...(authorOutcome !== undefined ? { authorOutcome } : {}),
          recipientId: command.recipientId,
          text: command.text,
          now: now(),
        });
    await this.resolve.reviewRepo.save(review.state);

    // Факт первой записи — в шину (подписчик: уведомление адресату);
    // перезапись событий не создаёт — publishEvents ничего не публикует.
    this.publishEvents(review);

    return {
      reviewId: review.state.uuid,
      campaignId: command.campaignId,
      recipientId: command.recipientId,
    };
  }

  /** Окно закрыто — прежняя ошибка `REVIEW_WINDOW_CLOSED`. */
  private ensureLive(ar: ReviewCampaignAr): void {
    if (!ar.isExpired(now().getTime())) return;
    this.throwError(
      errConflict<ReviewWindowClosedUcError>(
        'REVIEW_WINDOW_CLOSED',
        'Возможность оставлять отзывы закрыта: срок кампании истёк',
        {
          campaignId: ar.uuid,
          // legacy-формат: ISO до минуты (UTC)
          expiresAt: new Date(ar.expiresAt).toISOString().slice(0, 16),
        },
      ) as CreateReviewCmdMeta['errors'],
    );
  }

  /**
   * Право написать отзыв адресату и данные записи: направление «кто о ком» и
   * снапшот исхода автора-студента. Не автор окна — доступ запрещён, адресат
   * вне списка автора — конфликт.
   */
  private assertCanWrite(
    ar: ReviewCampaignAr,
    authorId: string,
    recipientId: string,
  ): { direction: ReviewDirection; authorOutcome: StudentOutcome | undefined } {
    const role = ar.authorRoleOf(authorId);
    if (role === undefined) {
      this.throwError(
        errAccessDenied<PeerReviewNotParticipantUcError>(
          'PEER_REVIEW_NOT_PARTICIPANT',
          'Автор не субъект окна и не ментор этой кампании',
          {},
        ) as CreateReviewCmdMeta['errors'],
      );
    }
    if (!ar.targetIdsFor(authorId).includes(recipientId)) {
      this.throwError(
        errConflict<RecipientNotAllowedUcError>(
          'PEER_REVIEW_RECIPIENT_NOT_ALLOWED',
          'Адресат недоступен по политике для роли автора',
          { campaignId: ar.uuid, authorId, recipientId },
        ) as CreateReviewCmdMeta['errors'],
      );
    }
    const direction: ReviewDirection =
      role === 'mentor'
        ? 'mentor_student'
        : recipientId === ar.mentorId
          ? 'student_mentor'
          : 'student_student';
    return {
      direction,
      authorOutcome: role === 'subject' ? ar.subjectOutcome : undefined,
    };
  }

  /** Перезапись: uuid и createdAt пары сохраняются, меняется только текст. */
  private overwrite(existing: Review, text: string): ReviewAr {
    const ar = new ReviewAr(existing);
    ar.overwrite(text);
    return ar;
  }
}

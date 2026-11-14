import type { ReadonlyAr } from 'dmg-core';
import type { ReviewCampaignAr } from '../review-campaign/review-campaign.ar';
import type { StudentOutcome } from '../shared/campaign-fields';
import type { ReviewDirection } from './review.state';

/** Черновик отзыва: направление и снимок исхода автора. */
export type ReviewDraft = {
  readonly direction: ReviewDirection;
  readonly authorOutcome?: StudentOutcome;
};

/**
 * DQS: направление отзыва и снимок исхода автора по данным кампании.
 * Только читает; допустимость пары проверяет `ReviewRules.recipientAllowed`.
 */
export class ReviewDraftDqs {
  constructor(private readonly campaign: ReadonlyAr<ReviewCampaignAr>) {}

  /**
   * Ментор → `mentor_student` без исхода. Субъект → ментору `student_mentor`,
   * соученику `student_student`, оба с исходом субъекта.
   */
  of(authorId: string, recipientId: string): ReviewDraft {
    if (this.campaign.isMentor(authorId))
      return { direction: 'mentor_student' };
    return {
      direction: this.campaign.isMentor(recipientId)
        ? 'student_mentor'
        : 'student_student',
      authorOutcome: this.campaign.subjectOutcome,
    };
  }
}

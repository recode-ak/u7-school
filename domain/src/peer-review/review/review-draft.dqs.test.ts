import { describe, expect, it } from 'bun:test';
import { ReviewCampaignAr } from '../review-campaign/review-campaign.ar';
import { ReviewDraftDqs } from './review-draft.dqs';

// Перенос логики `create-review-uc.ts:107-123`: направление и снимок исхода автора.

const SUBJECT = '77777777-7777-4777-8777-777777777777';
const MENTOR = '55555555-5555-4555-8555-555555555555';
const ALICE = '33333333-3333-4333-8333-333333333333';

const campaign = () =>
  ReviewCampaignAr.restore({
    uuid: '11111111-1111-4111-8111-111111111111',
    context: 'stream_fate',
    scopeId: '22222222-2222-4222-8222-222222222222',
    subjectId: SUBJECT,
    createdAt: 0,
    updatedAt: 0,
    version: 0,
    expiresAt: 1,
    participants: [ALICE],
    payload: { subjectOutcome: 'completed_passed', mentorId: MENTOR },
  });

describe('ReviewDraftDqs.of', () => {
  it('ментор → субъект: mentor_student, исхода автора нет', () => {
    const draft = ReviewDraftDqs.of(campaign(), MENTOR, SUBJECT);
    expect(draft.direction).toBe('mentor_student');
    expect(draft.authorOutcome).toBeUndefined();
  });

  it('субъект → ментор: student_mentor + исход субъекта', () => {
    expect(ReviewDraftDqs.of(campaign(), SUBJECT, MENTOR)).toEqual({
      direction: 'student_mentor',
      authorOutcome: 'completed_passed',
    });
  });

  it('субъект → соученик: student_student + исход субъекта', () => {
    expect(ReviewDraftDqs.of(campaign(), SUBJECT, ALICE)).toEqual({
      direction: 'student_student',
      authorOutcome: 'completed_passed',
    });
  });
});

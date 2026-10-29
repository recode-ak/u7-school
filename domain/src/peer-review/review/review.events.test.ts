import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { ReviewEvents } from './review.events';

const id = (n: number) =>
  `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const payload = {
  reviewId: id(1),
  campaignId: id(2),
  scopeId: id(3),
  authorId: id(4),
  recipientId: id(5),
  direction: 'student_student' as const,
};

describe('ReviewEvents.created (MAN-08)', () => {
  it('FQN peer-review.review.created (было review.created)', () => {
    expect(ReviewEvents.created.name).toBe('peer-review.review.created');
  });

  it('payload: reviewId, campaignId, scopeId, authorId, recipientId, direction', () => {
    const { payload: schema } = ReviewEvents.created;
    expect(v.parse(schema, payload)).toEqual(payload);
    for (const key of Object.keys(payload)) {
      const { [key as keyof typeof payload]: _, ...rest } = payload;
      expect(v.safeParse(schema, rest).success).toBe(false);
    }
  });

  it('направление — одно из трёх, прочее отклоняется', () => {
    const { payload: schema } = ReviewEvents.created;
    for (const direction of [
      'student_student',
      'student_mentor',
      'mentor_student',
    ]) {
      expect(v.safeParse(schema, { ...payload, direction }).success).toBe(true);
    }
    expect(
      v.safeParse(schema, { ...payload, direction: 'mentor_mentor' }).success,
    ).toBe(false);
  });

  it('идентификаторы — UUID', () => {
    const { payload: schema } = ReviewEvents.created;
    for (const key of [
      'reviewId',
      'campaignId',
      'scopeId',
      'authorId',
      'recipientId',
    ]) {
      expect(v.safeParse(schema, { ...payload, [key]: 'x' }).success).toBe(
        false,
      );
    }
  });

  it('make собирает событие с этим payload', () => {
    expect(ReviewEvents.created.make(payload).payload).toEqual(payload);
  });
});

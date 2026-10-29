import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { StudentEvents } from './student.events';

const ids = {
  studentId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  streamId: '33333333-3333-4333-8333-333333333333',
  moduleId: '44444444-4444-4444-8444-444444444444',
};

describe('StudentEvents.completed — контракт для peer-review', () => {
  const completed = { ...ids, outcome: 'advanced' as const };

  it('FQN stream.student.completed и payload', () => {
    expect(StudentEvents.completed.name).toBe('stream.student.completed');
    expect(v.parse(StudentEvents.completed.payload, completed)).toEqual(
      completed,
    );
    expect(
      v.parse(StudentEvents.completed.payload, {
        ...completed,
        outcome: 'not_advanced',
      }).outcome,
    ).toBe('not_advanced');
  });

  it('отклоняет чужой outcome и payload без поля', () => {
    const { payload } = StudentEvents.completed;
    expect(
      v.safeParse(payload, { ...completed, outcome: 'passed' }).success,
    ).toBe(false);
    const { moduleId: _, ...noModule } = completed;
    expect(v.safeParse(payload, noModule).success).toBe(false);
    const { outcome: __, ...noOutcome } = completed;
    expect(v.safeParse(payload, noOutcome).success).toBe(false);
  });
});

describe('StudentEvents.abandoned — контракт для peer-review', () => {
  const { moduleId: _, ...base } = ids;
  const abandoned = {
    ...base,
    who: 'self' as const,
    cause: 'voluntary' as const,
  };

  it('FQN stream.student.abandoned и payload (без moduleId)', () => {
    expect(StudentEvents.abandoned.name).toBe('stream.student.abandoned');
    expect(v.parse(StudentEvents.abandoned.payload, abandoned)).toEqual(
      abandoned,
    );
  });

  it.each([
    ['self', 'voluntary'],
    ['self', 'inactivity'],
    ['mentor', 'by_mentor'],
  ] as const)('who=%s cause=%s принимается', (who, cause) => {
    expect(
      v.safeParse(StudentEvents.abandoned.payload, { ...abandoned, who, cause })
        .success,
    ).toBe(true);
  });

  it('отклоняет чужие who/cause', () => {
    const { payload } = StudentEvents.abandoned;
    expect(v.safeParse(payload, { ...abandoned, who: 'admin' }).success).toBe(
      false,
    );
    expect(v.safeParse(payload, { ...abandoned, cause: 'other' }).success).toBe(
      false,
    );
  });
});

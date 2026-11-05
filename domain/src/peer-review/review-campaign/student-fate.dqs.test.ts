import { describe, expect, it } from 'bun:test';
import { StudentFateDqs } from './student-fate.dqs';

// Проекция исхода и состава адресатов (бывш. #subjectOutcome / #participantIds ER).
const SUBJECT = '77777777-7777-4777-8777-777777777777';
const MENTOR = '66666666-6666-4666-8666-666666666666';
const LIVE = '22222222-2222-4222-8222-222222222222';
const DONE = '33333333-3333-4333-8333-333333333333';
const DROP = '44444444-4444-4444-8444-444444444444';
const NEVER = '88888888-8888-4888-8888-888888888888';

const student = (
  userId: string,
  status: 'enrolled' | 'active' | 'abandoned' | 'advanced' | 'not_advanced',
  neverStarted = false,
) => ({
  studentId: crypto.randomUUID(),
  userId,
  status,
  neverStarted,
  inProgress: status === 'enrolled' || status === 'active',
});

const members = (subject = student(SUBJECT, 'advanced')) => ({
  mentorId: MENTOR,
  students: [
    subject,
    student(LIVE, 'active'),
    student(DONE, 'not_advanced'),
    student(DROP, 'abandoned'),
    student(NEVER, 'abandoned', true),
  ],
});

describe('StudentFateDqs.forCompleted', () => {
  it('advanced → completed_passed; not_advanced → completed_not_passed', () => {
    expect(
      StudentFateDqs.forCompleted(
        { userId: SUBJECT, outcome: 'advanced' },
        members(),
      ).outcome,
    ).toBe('completed_passed');
    expect(
      StudentFateDqs.forCompleted(
        { userId: SUBJECT, outcome: 'not_advanced' },
        members(),
      ).outcome,
    ).toBe('completed_not_passed');
  });

  it('участники: завершившиеся и ещё учащиеся, без субъекта и без abandoned (порядок состава)', () => {
    expect(
      StudentFateDqs.forCompleted(
        { userId: SUBJECT, outcome: 'advanced' },
        members(),
      ).participantIds,
    ).toEqual([LIVE, DONE]);
  });
});

describe('StudentFateDqs.forAbandoned', () => {
  it('participants всегда пуст (адресат только ментор)', () => {
    expect(
      StudentFateDqs.forAbandoned({ userId: SUBJECT }, members())
        .participantIds,
    ).toEqual([]);
  });

  it('субъект никогда не начинал (neverStarted) → never_started', () => {
    const m = members(student(SUBJECT, 'abandoned', true));
    expect(StudentFateDqs.forAbandoned({ userId: SUBJECT }, m).outcome).toBe(
      'never_started',
    );
  });

  it('иначе → dropped; субъекта нет в составе → dropped', () => {
    const m = members(student(SUBJECT, 'abandoned', false));
    expect(StudentFateDqs.forAbandoned({ userId: SUBJECT }, m).outcome).toBe(
      'dropped',
    );
    expect(
      StudentFateDqs.forAbandoned(
        { userId: '99999999-9999-4999-8999-999999999999' },
        m,
      ).outcome,
    ).toBe('dropped');
  });
});

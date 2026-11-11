import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from 'dmg-core/testing';
import { StreamRules } from './stream.rules';
import type { StreamStudentFact } from './stream.types';

// Перенос `stream-ds.test.ts` (`StreamDs.completeStream`, ФР-2): пока у
// кого-то нетерминальный статус (active/enrolled), завершить поток нельзя.
// «Завершён ли студент» отвечает студент: в факте это `settled`.

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '99999999-9999-4999-8999-999999999999';

const fact = (
  userId: string,
  status: StreamStudentFact['status'],
  settled: boolean,
): StreamStudentFact => ({
  studentId: crypto.randomUUID(),
  userId,
  status,
  settled,
  inProgress: !settled,
  neverStarted: false,
});

const { studentsSettled } = StreamRules.rules;

describe('StreamRules.studentsSettled', () => {
  it('все студенты в конечном статусе — ok', () => {
    expectOk(
      studentsSettled.check({
        students: [
          fact(U1, 'abandoned', true),
          fact(U2, 'advanced', true),
          fact(U3, 'not_advanced', true),
        ],
      }),
    );
  });

  it('active блокирует: STREAM_STUDENTS_IN_PROGRESS со списком { userId, status }', () => {
    const error = expectErr(
      studentsSettled.check({
        students: [fact(U1, 'abandoned', true), fact(U2, 'active', false)],
      }),
      'STREAM_STUDENTS_IN_PROGRESS',
    );
    expect(error.kind).toBe('conflict');
    expect(error.payload).toEqual({
      pending: [{ userId: U2, status: 'active' }],
    });
  });

  it('enrolled блокирует (дыра ФР-2)', () => {
    const error = expectErr(
      studentsSettled.check({ students: [fact(U2, 'enrolled', false)] }),
      'STREAM_STUDENTS_IN_PROGRESS',
    );
    expect(error.payload).toEqual({
      pending: [{ userId: U2, status: 'enrolled' }],
    });
  });

  it('в списке — все незавершённые, в порядке фактов', () => {
    const error = expectErr(
      studentsSettled.check({
        students: [
          fact(U1, 'enrolled', false),
          fact(U2, 'advanced', true),
          fact(U3, 'active', false),
        ],
      }),
      'STREAM_STUDENTS_IN_PROGRESS',
    );
    expect(error.payload).toEqual({
      pending: [
        { userId: U1, status: 'enrolled' },
        { userId: U3, status: 'active' },
      ],
    });
  });

  it('решает признак settled, а не название статуса', () => {
    expectOk(studentsSettled.check({ students: [fact(U1, 'active', true)] }));
  });
});

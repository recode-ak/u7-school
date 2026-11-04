import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { StudentEvents } from './student.events';
import { STREAM, STUDENT, USER } from './student.fixture';

// Новые события бездействия (решение 6) и сохранённые enrolled/completed/abandoned.
// Судьбу (fate) трёх старых событий проверяет `student.events.fate.test.ts`.

const base = { studentId: STUDENT, userId: USER, streamId: STREAM };
const ok = (schema: v.GenericSchema, value: unknown) =>
  v.safeParse(schema, value).success;

describe('StudentEvents — бездействие', () => {
  it('FQN по MAN-08: stream.student.<ключ>', () => {
    expect(StudentEvents.inactivityWarning.name).toBe(
      'stream.student.inactivityWarning',
    );
    expect(StudentEvents.inactivityRemoveCandidate.name).toBe(
      'stream.student.inactivityRemoveCandidate',
    );
  });

  it('inactivityWarning { studentId, userId, streamId, days } — без telegramId', () => {
    const { payload } = StudentEvents.inactivityWarning;
    expect(ok(payload, { ...base, days: 5 })).toBe(true);
    expect(ok(payload, base)).toBe(false);
    expect(ok(payload, { ...base, days: 'пять' })).toBe(false);
  });

  it('inactivityRemoveCandidate: те же поля плюс wasWarned (Т5)', () => {
    const { payload } = StudentEvents.inactivityRemoveCandidate;
    expect(ok(payload, { ...base, days: 7, wasWarned: false })).toBe(true);
    expect(ok(payload, { ...base, days: 7 })).toBe(false);
    expect(ok(payload, { ...base, days: 7, wasWarned: 'да' })).toBe(false);
  });

  it('три прежних события остались', () => {
    expect(Object.keys(StudentEvents).sort()).toEqual(
      [
        'abandoned',
        'completed',
        'enrolled',
        'inactivityRemoveCandidate',
        'inactivityWarning',
      ].sort(),
    );
  });
});

import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { StudentArDef } from './student.ar';
import { STEP_1, STREAM, STUDENT, USER } from './student.fixture';

const T = Date.UTC(2026, 5, 1, 10);

const record = {
  uuid: STUDENT,
  streamId: STREAM,
  userId: USER,
  enrolledAt: T,
  status: 'active',
  currentStepId: STEP_1,
  steps: [
    {
      stepId: STEP_1,
      status: 'completed',
      issuedAt: T,
      completedAt: T + 30 * 60_000,
    },
  ],
  createdAt: T,
};

const parse = (value: unknown) => v.safeParse(StudentArDef.state, value);

describe('StudentState — даты', () => {
  it('ISO-строка в дате отвергается', () => {
    const iso = '2026-06-02T08:30:00.000Z';
    expect(parse({ ...record, updatedAt: iso }).success).toBe(false);
    expect(parse({ ...record, enrolledAt: iso }).success).toBe(false);
  });
});

type Row = { title: string; patch: Record<string, unknown>; valid?: boolean };

describe('StudentState — разбор записи', () => {
  it.each<Row>([
    ...(
      ['enrolled', 'active', 'abandoned', 'advanced', 'not_advanced'] as const
    ).map((status) => ({
      title: `статус ${status} допустим`,
      patch: { status },
      valid: true,
    })),
    { title: 'uuid не UUID — отказ', patch: { uuid: 'x' } },
    { title: 'streamId не UUID — отказ', patch: { streamId: 'x' } },
    { title: 'userId не UUID — отказ', patch: { userId: 'x' } },
    { title: 'currentStepId не UUID — отказ', patch: { currentStepId: 'x' } },
    { title: 'неизвестный статус — отказ', patch: { status: 'graduated' } },
    {
      title: 'abandonDetails.who вне списка — отказ',
      patch: { abandonDetails: { who: 'x', cause: 'voluntary' } },
    },
    {
      title: 'abandonDetails.cause вне списка — отказ',
      patch: { abandonDetails: { who: 'self', cause: 'x' } },
    },
    {
      title: 'nextPreference вне списка — отказ',
      patch: { completionDetails: { nextPreference: 'x' } },
    },
    {
      title: 'статус шага вне списка — отказ',
      patch: { steps: [{ stepId: STEP_1, status: 'x', issuedAt: 1 }] },
    },
    {
      title: 'kind уведомления вне списка — отказ',
      patch: { notices: [{ kind: 'x', sentAt: 1 }] },
    },
    {
      title: 'дата зачисления — не дата — отказ',
      patch: { enrolledAt: 'вчера' },
    },
  ])('$title', ({ patch, valid = false }) => {
    expect(parse({ ...record, ...patch }).success).toBe(valid);
  });
});

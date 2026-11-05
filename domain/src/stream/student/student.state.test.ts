import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { StudentArDef } from './student.ar';
import { STEP_1, STREAM, STUDENT, USER } from './student.fixture';

const legacy = {
  uuid: STUDENT,
  streamId: STREAM,
  userId: USER,
  enrolledAt: '2026-06-01T10:00',
  status: 'active',
  currentStepId: STEP_1,
  steps: [
    {
      stepId: STEP_1,
      status: 'completed',
      issuedAt: '2026-06-01T10:00',
      completedAt: '2026-06-01T10:30:00.000Z',
    },
  ],
  createdAt: '2026-06-01T10:00',
};

const parse = (value: unknown) => v.safeParse(StudentArDef.state, value);

describe('StudentState — legacy-запись', () => {
  it('legacy updatedAt (ISO с зоной) сохраняется числом', () => {
    const res = parse({ ...legacy, updatedAt: '2026-06-02T08:30:00.000Z' });
    expect(res.success && res.output.updatedAt).toBe(
      Date.UTC(2026, 5, 2, 8, 30),
    );
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
    expect(parse({ ...legacy, ...patch }).success).toBe(valid);
  });
});

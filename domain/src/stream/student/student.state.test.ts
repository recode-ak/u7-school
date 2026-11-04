import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { StudentArDef } from './student.ar';
import { STEP_1, STREAM, STUDENT, USER } from './student.fixture';

// Перенос `entity.test.ts` (StudentSchema) на state по Def (DOM-11/12):
// даты — числа (UTC); legacy-запись с ISO (`YYYY-MM-DDTHH:mm` и полный ISO)
// читается, нет `updatedAt` → `createdAt`, нет `version` → 0.

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
  it('ISO-даты (без зоны — UTC) становятся числами, updatedAt = createdAt, version = 0', () => {
    const res = parse(legacy);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.enrolledAt).toBe(Date.UTC(2026, 5, 1, 10));
      expect(res.output.createdAt).toBe(Date.UTC(2026, 5, 1, 10));
      expect(res.output.updatedAt).toBe(Date.UTC(2026, 5, 1, 10));
      expect(res.output.version).toBe(0);
    }
  });

  it('даты шагов: issuedAt и completedAt — числа', () => {
    const res = parse(legacy);
    expect(res.success && res.output.steps).toEqual([
      {
        stepId: STEP_1,
        status: 'completed',
        issuedAt: Date.UTC(2026, 5, 1, 10),
        completedAt: Date.UTC(2026, 5, 1, 10, 30),
      },
    ]);
  });

  it('sentAt маркера до минуты (`YYYY-MM-DDTHH:mm`) становится числом UTC', () => {
    const res = parse({
      ...legacy,
      notices: [
        { kind: 'inactivity_warn_student', sentAt: '2026-06-03T19:00' },
      ],
    });
    expect(res.success && res.output.notices).toEqual([
      { kind: 'inactivity_warn_student', sentAt: Date.UTC(2026, 5, 3, 19) },
    ]);
  });

  it('legacy updatedAt (ISO с зоной) сохраняется числом', () => {
    const res = parse({ ...legacy, updatedAt: '2026-06-02T08:30:00.000Z' });
    expect(res.success && res.output.updatedAt).toBe(
      Date.UTC(2026, 5, 2, 8, 30),
    );
  });

  it('запись нового формата (числа, version) проходит как есть', () => {
    const t = Date.UTC(2026, 5, 1, 10);
    const res = parse({
      ...legacy,
      enrolledAt: t,
      createdAt: t,
      updatedAt: t + 5,
      version: 3,
      steps: [],
    });
    expect(res.success && [res.output.updatedAt, res.output.version]).toEqual([
      t + 5,
      3,
    ]);
  });

  it('completionDetails и abandonDetails сохраняются', () => {
    const done = parse({
      ...legacy,
      status: 'advanced',
      completionDetails: { nextPreference: 'wants_next' },
    });
    expect(done.success && done.output.completionDetails).toEqual({
      nextPreference: 'wants_next',
    });
    const gone = parse({
      ...legacy,
      status: 'abandoned',
      abandonDetails: { who: 'mentor', cause: 'inactivity' },
    });
    expect(gone.success && gone.output.abandonDetails).toEqual({
      who: 'mentor',
      cause: 'inactivity',
    });
  });
});

describe('StudentState — отказы разбора (перенос entity.test.ts)', () => {
  it.each([
    ['uuid не UUID', { uuid: 'x' }],
    ['streamId не UUID', { streamId: 'x' }],
    ['userId не UUID', { userId: 'x' }],
    ['currentStepId не UUID', { currentStepId: 'x' }],
    ['неизвестный статус', { status: 'graduated' }],
    [
      'abandonDetails.who вне списка',
      { abandonDetails: { who: 'x', cause: 'voluntary' } },
    ],
    [
      'abandonDetails.cause вне списка',
      { abandonDetails: { who: 'self', cause: 'x' } },
    ],
    [
      'nextPreference вне списка',
      { completionDetails: { nextPreference: 'x' } },
    ],
    [
      'статус шага вне списка',
      { steps: [{ stepId: STEP_1, status: 'x', issuedAt: 1 }] },
    ],
    ['kind уведомления вне списка', { notices: [{ kind: 'x', sentAt: 1 }] }],
    ['дата зачисления — не дата', { enrolledAt: 'вчера' }],
  ])('%s — отказ', (_, patch) => {
    expect(parse({ ...legacy, ...patch }).success).toBe(false);
  });

  it.each(['enrolled', 'active', 'abandoned', 'advanced', 'not_advanced'])(
    'статус %s допустим',
    (status) => {
      expect(parse({ ...legacy, status }).success).toBe(true);
    },
  );
});

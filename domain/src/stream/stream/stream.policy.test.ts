import { describe, expect, it } from 'bun:test';
import type { UserView } from '@u7-scl/domain/user/contract';
import { userSubject } from '@u7-scl/domain/user/testing';
import { allowed } from 'dmg-core';
import { StudentAr } from '../student/student.ar';
import {
  completed,
  issued,
  STEP_1,
  STEP_2,
  stored as storedStudent,
  T0,
  USER,
} from '../student/student.fixture';
import { StreamAr } from './stream.ar';
import { MENTOR, OTHER_MENTOR, STREAM, stored } from './stream.fixture';
import { StreamPolicy } from './stream.policy';

// Перенос `policy.test.ts` (canCreate, canEdit) на Policy по Def (TST-02):
// canCreate — роль MENTOR; canManage — ментор потока или админ.
// canReadContent (Ф4а) — студент этого потока, ментор потока или админ.

const OTHER_STREAM = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f11';

const who = (uuid: string, ...roles: UserView['roles']) =>
  userSubject({ uuid, roles });
const ctx = { stream: StreamAr.restore(stored('active')) };

const { canCreate, canManage } = StreamPolicy.rules;

describe('StreamPolicy.canCreate', () => {
  it('ментор — allowed', () => {
    expect(canCreate.evaluate(who(MENTOR, 'MENTOR'), {})).toEqual(allowed);
  });

  it('админ без роли MENTOR — denied (как в legacy)', () => {
    expect(canCreate.evaluate(who(MENTOR, 'ADMIN'), {}).allowed).toBe(false);
  });

  it('без субъекта — denied', () => {
    expect(canCreate.evaluate(undefined, {}).allowed).toBe(false);
  });
});

describe('StreamPolicy.canManage', () => {
  it.each(['enrollment', 'active', 'completed', 'archived'] as const)(
    'ментор потока в статусе %s — allowed',
    (status) => {
      const c = { stream: StreamAr.restore(stored(status)) };
      expect(canManage.evaluate(who(MENTOR, 'MENTOR'), c)).toEqual(allowed);
    },
  );

  it('ментор потока без роли MENTOR (по uuid) — allowed', () => {
    expect(canManage.evaluate(who(MENTOR, 'GUEST'), ctx).allowed).toBe(true);
  });

  it('админ, не ментор потока — allowed', () => {
    expect(canManage.evaluate(who(OTHER_MENTOR, 'ADMIN'), ctx)).toEqual(
      allowed,
    );
  });

  it('чужой ментор — denied', () => {
    expect(canManage.evaluate(who(OTHER_MENTOR, 'MENTOR'), ctx).allowed).toBe(
      false,
    );
  });

  it('без субъекта (гость-вызывающий) — denied', () => {
    expect(canManage.evaluate(undefined, ctx).allowed).toBe(false);
  });
});

describe('StreamPolicy.canReadContent', () => {
  const { canReadContent } = StreamPolicy.rules;
  const stream = StreamAr.restore(stored('active'));
  const student = (userId: string, streamId = STREAM) =>
    StudentAr.restore(storedStudent('active', { userId, streamId }));

  it('студент этого потока — allowed', () => {
    expect(
      canReadContent.evaluate(who(USER, 'GUEST'), {
        stream,
        student: student(USER),
      }),
    ).toEqual(allowed);
  });

  it('запись студента другого потока — denied', () => {
    const decision = canReadContent.evaluate(who(USER, 'GUEST'), {
      stream,
      student: student(USER, OTHER_STREAM),
    });
    expect(decision.allowed).toBe(false);
  });

  it('запись чужого студента — denied', () => {
    const decision = canReadContent.evaluate(who(OTHER_MENTOR, 'GUEST'), {
      stream,
      student: student(USER),
    });
    expect(decision.allowed).toBe(false);
  });

  it('ментор потока — allowed', () => {
    expect(
      canReadContent.evaluate(who(MENTOR, 'MENTOR'), {
        stream,
        student: undefined,
      }),
    ).toEqual(allowed);
  });

  it('администратор — allowed', () => {
    expect(
      canReadContent.evaluate(who(OTHER_MENTOR, 'ADMIN'), {
        stream,
        student: undefined,
      }),
    ).toEqual(allowed);
  });

  it('ментор (роль) чужого потока без записи — denied с сообщением', () => {
    const decision = canReadContent.evaluate(who(OTHER_MENTOR, 'MENTOR'), {
      stream,
      student: undefined,
    });
    expect(decision).toMatchObject({
      allowed: false,
      denyMessage: 'Нет доступа к материалам потока',
    });
  });

  it('без субъекта — denied', () => {
    expect(
      canReadContent.evaluate(undefined, { stream, student: undefined })
        .allowed,
    ).toBe(false);
  });
});

// canReadStep (замок по прогрессу, Ф4а): студент потока читает шаг, только если
// шаг в его прогрессе (`StudentAr.hasIssued` — completed или issued); ментор
// потока и админ — любой шаг. Контекст — как у canReadContent плюс `stepId`.
describe('StreamPolicy.canReadStep', () => {
  const { canReadStep } = StreamPolicy.rules;
  const stream = StreamAr.restore(stored('active'));
  const student = (
    status: Parameters<typeof storedStudent>[0],
    steps: Parameters<typeof storedStudent>[1] = {},
  ) => StudentAr.restore(storedStudent(status, { userId: USER, ...steps }));
  const progress = {
    steps: [completed(STEP_1, T0, T0), issued(STEP_2, T0)],
  };

  it('студент: шаг completed — allowed', () => {
    expect(
      canReadStep.evaluate(who(USER, 'GUEST'), {
        stream,
        student: student('active', progress),
        stepId: STEP_1,
      }),
    ).toEqual(allowed);
  });

  it('студент: шаг issued — allowed', () => {
    expect(
      canReadStep.evaluate(who(USER, 'GUEST'), {
        stream,
        student: student('active', progress),
        stepId: STEP_2,
      }),
    ).toEqual(allowed);
  });

  it('студент: шаг не выдан — denied', () => {
    const decision = canReadStep.evaluate(who(USER, 'GUEST'), {
      stream,
      student: student('active', { steps: [completed(STEP_1, T0, T0)] }),
      stepId: STEP_2,
    });
    expect(decision.allowed).toBe(false);
  });

  it.each(['abandoned', 'advanced', 'not_advanced'] as const)(
    'студент со статусом %s: пройденный — allowed, не выданный — denied',
    (status) => {
      const c = {
        stream,
        student: student(status, { steps: [completed(STEP_1, T0, T0)] }),
      };
      expect(
        canReadStep.evaluate(who(USER, 'GUEST'), { ...c, stepId: STEP_1 }),
      ).toEqual(allowed);
      expect(
        canReadStep.evaluate(who(USER, 'GUEST'), { ...c, stepId: STEP_2 })
          .allowed,
      ).toBe(false);
    },
  );

  it('студент другого потока с выданным шагом — denied', () => {
    const decision = canReadStep.evaluate(who(USER, 'GUEST'), {
      stream,
      student: student('active', { ...progress, streamId: OTHER_STREAM }),
      stepId: STEP_1,
    });
    expect(decision.allowed).toBe(false);
  });

  it.each([
    ['ментор потока', who(MENTOR, 'MENTOR')],
    ['администратор', who(OTHER_MENTOR, 'ADMIN')],
  ])('%s: не выданный студентам шаг — allowed', (_, subject) => {
    expect(
      canReadStep.evaluate(subject, {
        stream,
        student: undefined,
        stepId: STEP_2,
      }),
    ).toEqual(allowed);
  });

  it('ментор (роль) чужого потока без записи — denied', () => {
    expect(
      canReadStep.evaluate(who(OTHER_MENTOR, 'MENTOR'), {
        stream,
        student: undefined,
        stepId: STEP_1,
      }).allowed,
    ).toBe(false);
  });
});

import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from 'dmg-core/testing';
import { StudentAr } from './student.ar';
import { StudentEvents } from './student.events';
import {
  completed,
  DAY,
  input,
  issued,
  MODULE,
  STEP_1,
  STEP_2,
  STEP_3,
  STREAM,
  STUDENT,
  stored,
  T0,
  T1,
  USER,
} from './student.fixture';
import type { StudentState } from './student.state';

// Перенос `a-root.test.ts` (Student) на Ar по Def: бросавшие `throwBadRequest`
// ветки стали `Err` с кодом `STUDENT_*`, события — из `StudentEvents`,
// даты — числа UTC. Расчёты lag/median уехали в DQS (student-progress.dqs.test.ts).

const restore = (
  status: StudentState['status'],
  extra: Partial<StudentState> = {},
) => StudentAr.restore(stored(status, extra));

describe('StudentAr.enroll', () => {
  it('студент enrolled: шагов нет, currentStepId = первый шаг, enrolledAt = at, version 0', () => {
    const ar = expectOk(StudentAr.enroll(input, T0));
    expect(ar.snapshot()).toEqual({
      uuid: STUDENT,
      streamId: STREAM,
      userId: USER,
      enrolledAt: T0,
      status: 'enrolled',
      currentStepId: STEP_1,
      steps: [],
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    });
  });
});

describe('StudentAr.activate', () => {
  it('enrolled → active, notices сброшены', () => {
    const ar = restore('enrolled', {
      notices: [{ kind: 'inactivity_warn_student', sentAt: T0 }],
    });
    expectOk(ar.activate(T1));
    expect(ar.snapshot().status).toBe('active');
    expect(ar.snapshot().notices ?? []).toEqual([]);
    expect(ar.snapshot().updatedAt).toBe(T1);
    expect(ar.pullEvents()).toEqual([]);
  });

  it.each(['active', 'abandoned', 'advanced', 'not_advanced'] as const)(
    'из %s — STUDENT_NOT_ENROLLED, состояние не меняется',
    (status) => {
      const ar = restore(status);
      const error = expectErr(ar.activate(T1), 'STUDENT_NOT_ENROLLED');
      expect(error.kind).toBe('conflict');
      expect(ar.snapshot()).toEqual(stored(status));
    },
  );
});

describe('StudentAr.drop', () => {
  it.each(['enrolled', 'active'] as const)(
    'из %s → abandoned { self, voluntary }, событие abandoned',
    (status) => {
      const ar = restore(status);
      expectOk(ar.drop(T1));
      expect(ar.snapshot().status).toBe('abandoned');
      expect(ar.snapshot().abandonDetails).toEqual({
        who: 'self',
        cause: 'voluntary',
      });
      expect(ar.pullEvents()).toEqual([
        StudentEvents.abandoned.make({
          studentId: STUDENT,
          userId: USER,
          streamId: STREAM,
          who: 'self',
          cause: 'voluntary',
        }),
      ]);
    },
  );

  it.each(['abandoned', 'advanced', 'not_advanced'] as const)(
    'из %s — STUDENT_NOT_STUDYING, события нет',
    (status) => {
      const ar = restore(status);
      expectErr(ar.drop(T1), 'STUDENT_NOT_STUDYING');
      expect(ar.pullEvents()).toEqual([]);
      expect(ar.snapshot().status).toBe(status);
    },
  );
});

describe('StudentAr.markAbandoned', () => {
  it.each([
    ['enrolled', 'inactivity'],
    ['active', 'inactivity'],
    ['enrolled', 'by_mentor'],
    ['active', 'by_mentor'],
  ] as const)(
    'из %s, причина %s → abandoned { mentor, cause }',
    (status, cause) => {
      const ar = restore(status);
      expectOk(ar.markAbandoned(cause, T1));
      expect(ar.snapshot().status).toBe('abandoned');
      expect(ar.snapshot().abandonDetails).toEqual({ who: 'mentor', cause });
      expect(ar.pullEvents()).toEqual([
        StudentEvents.abandoned.make({
          studentId: STUDENT,
          userId: USER,
          streamId: STREAM,
          who: 'mentor',
          cause,
        }),
      ]);
    },
  );

  it.each(['abandoned', 'advanced', 'not_advanced'] as const)(
    'из %s — STUDENT_NOT_STUDYING',
    (status) => {
      const ar = restore(status);
      expectErr(ar.markAbandoned('by_mentor', T1), 'STUDENT_NOT_STUDYING');
      expect(ar.pullEvents()).toEqual([]);
    },
  );
});

describe('StudentAr.complete', () => {
  it.each([
    ['active', 'advanced'],
    ['active', 'not_advanced'],
    ['advanced', 'not_advanced'],
    ['not_advanced', 'advanced'],
    ['advanced', 'advanced'],
    ['not_advanced', 'not_advanced'],
  ] as const)(
    'из %s с исходом %s — Ok, nextPreference undecided, событие completed',
    (status, outcome) => {
      const ar = restore(status);
      expectOk(ar.complete(outcome, MODULE, T1));
      expect(ar.snapshot().status).toBe(outcome);
      expect(ar.snapshot().completionDetails).toEqual({
        nextPreference: 'undecided',
      });
      expect(ar.pullEvents()).toEqual([
        StudentEvents.completed.make({
          studentId: STUDENT,
          userId: USER,
          streamId: STREAM,
          moduleId: MODULE,
          outcome,
        }),
      ]);
    },
  );

  it.each([
    ['enrolled', 'advanced'],
    ['enrolled', 'not_advanced'],
    ['abandoned', 'advanced'],
    ['abandoned', 'not_advanced'],
  ] as const)(
    'из %s с исходом %s — STUDENT_NOT_COMPLETABLE',
    (status, outcome) => {
      const ar = restore(status);
      const error = expectErr(
        ar.complete(outcome, MODULE, T1),
        'STUDENT_NOT_COMPLETABLE',
      );
      expect(error.kind).toBe('conflict');
      expect(ar.pullEvents()).toEqual([]);
      expect(ar.snapshot().status).toBe(status);
    },
  );
});

describe('StudentAr.issueStep', () => {
  it('добавляет issued-запись и переставляет currentStepId', () => {
    const ar = restore('active', { steps: [completed(STEP_1, T0, T0)] });
    expectOk(ar.issueStep(STEP_2, T1));
    expect(ar.snapshot().steps).toEqual([
      completed(STEP_1, T0, T0),
      issued(STEP_2, T1),
    ]);
    expect(ar.snapshot().currentStepId).toBe(STEP_2);
  });

  it('шаг уже выдан — STUDENT_STEP_ALREADY_ISSUED, шагов не прибавилось', () => {
    const ar = restore('active', { steps: [issued(STEP_1, T0)] });
    expectErr(ar.issueStep(STEP_1, T1), 'STUDENT_STEP_ALREADY_ISSUED');
    expect(ar.snapshot().steps).toHaveLength(1);
  });
});

describe('StudentAr.completeStep', () => {
  it('шаг не выдан — STUDENT_STEP_NOT_ISSUED', () => {
    const ar = restore('active');
    expectErr(ar.completeStep(STEP_1, STEP_2, T1), 'STUDENT_STEP_NOT_ISSUED');
    expect(ar.snapshot().steps).toEqual([]);
  });

  it('завершает шаг и выдаёт следующий → completed', () => {
    const ar = restore('active', { steps: [issued(STEP_1, T0)] });
    expect(expectOk(ar.completeStep(STEP_1, STEP_2, T1))).toBe('completed');
    expect(ar.snapshot().steps).toEqual([
      completed(STEP_1, T0, T1),
      issued(STEP_2, T1),
    ]);
    expect(ar.snapshot().currentStepId).toBe(STEP_2);
  });

  it('следующего шага нет → finished, новых записей нет', () => {
    const ar = restore('active', { steps: [issued(STEP_1, T0)] });
    expect(expectOk(ar.completeStep(STEP_1, undefined, T1))).toBe('finished');
    expect(ar.snapshot().steps).toEqual([completed(STEP_1, T0, T1)]);
    expect(ar.snapshot().currentStepId).toBe(STEP_1);
  });

  it('повтор завершённого шага → already_completed, состояние не меняется', () => {
    const steps = [completed(STEP_1, T0, T0), issued(STEP_2, T0)];
    const ar = restore('active', { steps, currentStepId: STEP_2 });
    expect(expectOk(ar.completeStep(STEP_1, STEP_2, T1))).toBe(
      'already_completed',
    );
    expect(ar.snapshot().steps).toEqual(steps);
    expect(ar.snapshot().currentStepId).toBe(STEP_2);
  });

  it('следующий шаг уже выдан — дубль не создаётся, currentStepId не меняется', () => {
    const ar = restore('active', {
      steps: [issued(STEP_1, T0), issued(STEP_2, T0)],
      currentStepId: STEP_3,
    });
    expect(expectOk(ar.completeStep(STEP_1, STEP_2, T1))).toBe('completed');
    expect(ar.snapshot().steps.map((s) => s.stepId)).toEqual([STEP_1, STEP_2]);
    expect(ar.snapshot().currentStepId).toBe(STEP_3);
  });

  it('завершение шага сбрасывает notices', () => {
    const ar = restore('active', {
      steps: [issued(STEP_1, T0)],
      notices: [{ kind: 'inactivity_warn_student', sentAt: T0 }],
    });
    expectOk(ar.completeStep(STEP_1, STEP_2, T1));
    expect(ar.snapshot().notices ?? []).toEqual([]);
  });
});

describe('StudentAr — вопросы', () => {
  it.each([
    ['enrolled', 'in_progress', true, true, false, false],
    ['active', 'in_progress', true, false, false, false],
    ['abandoned', 'abandoned', false, false, true, false],
    ['advanced', 'completed', false, false, true, true],
    ['not_advanced', 'completed', false, false, true, false],
  ] as const)(
    '%s: категория %s, inProgress %s, enrolled %s, terminal %s, passed %s',
    (status, category, inProgress, enrolled, terminal, passed) => {
      const ar = restore(status);
      expect(ar.outcomeCategory()).toBe(category);
      expect(ar.isInProgress()).toBe(inProgress);
      expect(ar.isEnrolled()).toBe(enrolled);
      expect(ar.isTerminal()).toBe(terminal);
      expect(ar.isPassed()).toBe(passed);
    },
  );

  it('neverStarted: только выбывший без завершённого шага', () => {
    expect(restore('abandoned').neverStarted()).toBe(true);
    expect(
      restore('abandoned', { steps: [issued(STEP_1, T0)] }).neverStarted(),
    ).toBe(true);
    expect(
      restore('abandoned', {
        steps: [completed(STEP_1, T0, T0)],
      }).neverStarted(),
    ).toBe(false);
    expect(restore('active').neverStarted()).toBe(false);
    expect(restore('advanced').neverStarted()).toBe(false);
  });

  it('outcomeSigns: завершение', () => {
    expect(restore('advanced').outcomeSigns()).toEqual(['passed']);
    expect(restore('not_advanced').outcomeSigns()).toEqual(['not_passed']);
    expect(restore('active').outcomeSigns()).toEqual([]);
  });

  it('outcomeSigns: уход — «не начал» сочетается с причиной', () => {
    const gone = (
      cause: 'voluntary' | 'inactivity' | 'by_mentor',
      who: 'self' | 'mentor',
    ) =>
      restore('abandoned', {
        abandonDetails: { who, cause },
        steps: [completed(STEP_1, T0, T0)],
      });
    expect(gone('voluntary', 'self').outcomeSigns()).toEqual([
      'left_voluntarily',
    ]);
    expect(gone('inactivity', 'mentor').outcomeSigns()).toEqual([
      'removed_by_mentor',
    ]);
    expect(gone('by_mentor', 'mentor').outcomeSigns()).toEqual([
      'removed_by_mentor',
    ]);
    expect(
      restore('abandoned', {
        abandonDetails: { who: 'self', cause: 'voluntary' },
      }).outcomeSigns(),
    ).toEqual(['never_started', 'left_voluntarily']);
  });

  it('outcomeSigns: legacy-запись abandoned без abandonDetails — без признака причины', () => {
    expect(restore('abandoned').outcomeSigns()).toEqual(['never_started']);
    expect(
      restore('abandoned', {
        steps: [completed(STEP_1, T0, T0)],
      }).outcomeSigns(),
    ).toEqual([]);
  });
});

describe('StudentAr.view', () => {
  it('state без notices плюс ответы вопросов; учащийся — inProgress, не passed', () => {
    const ar = restore('abandoned', {
      abandonDetails: { who: 'self', cause: 'voluntary' },
      notices: [{ kind: 'inactivity_warn_student', sentAt: T0 }],
    });
    const view = ar.view();
    expect('notices' in view).toBe(false);
    expect(view).toMatchObject({
      uuid: STUDENT,
      userId: USER,
      streamId: STREAM,
      status: 'abandoned',
      abandonDetails: { who: 'self', cause: 'voluntary' },
      outcome: {
        category: 'abandoned',
        signs: ['never_started', 'left_voluntarily'],
      },
      inProgress: false,
      enrolled: false,
      neverStarted: true,
      passed: false,
    });

    expect(restore('enrolled').view()).toMatchObject({
      inProgress: true,
      enrolled: true,
      passed: false,
      outcome: { category: 'in_progress', signs: [] },
    });
    expect(restore('advanced').view()).toMatchObject({ passed: true });
  });
});

// ── Бездействие: перенос inactivity-sweep-job.test.ts в Ar (решение 9) ──

describe('StudentAr — бездействие', () => {
  const at = (days: number, extraMs = 0) => T0 + days * DAY + extraMs;
  const pull = (ar: StudentAr) =>
    ar.pullEvents().map((e): [string, unknown] => [e.name, e.payload]);

  it('порог 5 дней: в 4 дня 23 ч уведомлять нечего, в 5 дней — пора', () => {
    const ar = restore('enrolled');
    expect(ar.needsInactivityNotice(at(5) - 3_600_000)).toBe(false);
    expect(ar.needsInactivityNotice(at(5))).toBe(true);
  });

  it('5 дней без шагов (от enrolledAt): предупреждение студенту, ментору ещё нет', () => {
    const ar = restore('enrolled');
    expectOk(ar.noticeInactivity(at(5)));
    expect(pull(ar)).toEqual([
      [
        StudentEvents.inactivityWarning.name,
        { studentId: STUDENT, userId: USER, streamId: STREAM, days: 5 },
      ],
    ]);
    expect(ar.snapshot().notices).toEqual([
      { kind: 'inactivity_warn_student', sentAt: at(5) },
    ]);
  });

  it('7 дней впервые: студенту и ментору, wasWarned = false', () => {
    const ar = restore('active');
    expectOk(ar.noticeInactivity(at(7)));
    expect(pull(ar)).toEqual([
      [
        StudentEvents.inactivityWarning.name,
        { studentId: STUDENT, userId: USER, streamId: STREAM, days: 7 },
      ],
      [
        StudentEvents.inactivityRemoveCandidate.name,
        {
          studentId: STUDENT,
          userId: USER,
          streamId: STREAM,
          days: 7,
          wasWarned: false,
        },
      ],
    ]);
    expect(
      ar
        .snapshot()
        .notices?.map((n) => n.kind)
        .sort(),
    ).toEqual(['inactivity_warn_mentor', 'inactivity_warn_student']);
  });

  it('wasWarned = true, если маркер студента был до прогона', () => {
    const ar = restore('active', {
      notices: [{ kind: 'inactivity_warn_student', sentAt: at(5) }],
    });
    expectOk(ar.noticeInactivity(at(7)));
    const events = pull(ar);
    expect(events.map(([name]) => name)).toEqual([
      StudentEvents.inactivityWarning.name,
      StudentEvents.inactivityRemoveCandidate.name,
    ]);
    expect(events[1]?.[1]).toMatchObject({
      days: 7,
      wasWarned: true,
    });
  });

  it('повтор «через 2 дня»: через день — пусто, через два — снова', () => {
    const ar = restore('active', {
      notices: [{ kind: 'inactivity_warn_student', sentAt: at(5) }],
    });
    expect(ar.needsInactivityNotice(at(6))).toBe(false);
    expectOk(ar.noticeInactivity(at(6)));
    expect(pull(ar)).toEqual([]);
    expect(ar.needsInactivityNotice(at(7))).toBe(true);
  });

  it('цепочки независимы: после 7 дней — пусто на 8-й, оба повтора на 9-й', () => {
    const ar = restore('active');
    expectOk(ar.noticeInactivity(at(7)));
    ar.pullEvents();
    expect(ar.needsInactivityNotice(at(8))).toBe(false);
    expectOk(ar.noticeInactivity(at(9)));
    expect(pull(ar).map(([name]) => name)).toEqual([
      StudentEvents.inactivityWarning.name,
      StudentEvents.inactivityRemoveCandidate.name,
    ]);
    // маркер по виду один: запись заменяется, история не копится
    expect(ar.snapshot().notices).toHaveLength(2);
  });

  it('sentAt округляется вниз до минуты (legacy slice(0,16))', () => {
    const ar = restore('enrolled');
    expectOk(ar.noticeInactivity(at(5, 37_000)));
    expect(ar.snapshot().notices).toEqual([
      { kind: 'inactivity_warn_student', sentAt: at(5) },
    ]);
  });

  it('дрожание расписания: 5 дней минус секунды после минуты не теряет повтор', () => {
    const ar = restore('active', {
      notices: [{ kind: 'inactivity_warn_student', sentAt: at(5, 59_000) }],
    });
    // sentAt записан как есть; сравнение — по целым дням от sentAt
    expect(ar.needsInactivityNotice(at(7, 59_000))).toBe(true);
  });

  it('дни считаются от последней активности по шагам, а не от enrolledAt', () => {
    const ar = restore('active', {
      steps: [completed(STEP_1, at(1), at(3))],
    });
    expect(ar.needsInactivityNotice(at(7))).toBe(false); // 4 дня от шага
    expect(ar.needsInactivityNotice(at(8))).toBe(true); // 5 дней
    expectOk(ar.noticeInactivity(at(8)));
    expect(pull(ar)).toEqual([
      [
        StudentEvents.inactivityWarning.name,
        { studentId: STUDENT, userId: USER, streamId: STREAM, days: 5 },
      ],
    ]);
  });

  it('последняя активность: completedAt важнее issuedAt, берётся максимум', () => {
    const ar = restore('active', {
      steps: [issued(STEP_2, at(4)), completed(STEP_1, at(0), at(2))],
    });
    expect(ar.needsInactivityNotice(at(8))).toBe(false); // 4 дня от выдачи
    expect(ar.needsInactivityNotice(at(9))).toBe(true);
  });

  it.each(['abandoned', 'advanced', 'not_advanced'] as const)(
    'студент в статусе %s уведомлений не требует',
    (status) => {
      expect(restore(status).needsInactivityNotice(at(30))).toBe(false);
    },
  );

  it('noticeInactivity, когда нечего слать, — Ok без событий и без изменений', () => {
    const ar = restore('active');
    expectOk(ar.noticeInactivity(at(1)));
    expect(pull(ar)).toEqual([]);
    expect(ar.snapshot()).toEqual(stored('active'));
  });
});

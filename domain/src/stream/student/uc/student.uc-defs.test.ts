import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { StudentAr } from '../student.ar';
import { STREAM, STUDENT, stored, USER } from '../student.fixture';
import { StudentPolicy } from '../student.policy';
import { CompleteStepUcDef } from './complete-step.uc';
import { CompleteStudentUcDef } from './complete-student.uc';
import { DropStudentUcDef } from './drop-student.uc';
import { EnrollStudentUcDef } from './enroll-student.uc';
import { GetActiveStudentUcDef } from './get-active-student.uc';
import { GetStudentByUserUcDef } from './get-student-by-user.uc';
import { GetStudentProgressUcDef } from './get-student-progress.uc';
import { MarkAbandonedUcDef } from './mark-abandoned.uc';

// Def 8 UC студента (MAN-11): имя, тип, callers, Policy, правила, ошибки,
// события, вход и выход. `set-next-preference` и `list-stream-students` удалены.

const STEP = '33333333-3333-4333-8333-333333333333';
const ok = (schema: v.GenericSchema, value: unknown) =>
  v.safeParse(schema, value).success;
const view = StudentAr.restore(stored('active')).view();

describe('EnrollStudentUcDef', () => {
  it('command пользователя: allowAll, calls getModulePrerequisite, событие enrolled', () => {
    expect(normalize(EnrollStudentUcDef)).toMatchObject({
      name: 'enrollStudent',
      type: 'command',
      aggregate: 'student',
      callers: ['user'],
      calls: ['getModulePrerequisite'],
      emits: ['stream.student.enrolled'],
    });
    expect(EnrollStudentUcDef.policy.op).toBe('allowAll');
  });

  it('ошибки: поток не найден и четыре отказа зачисления', () => {
    expect(normalize(EnrollStudentUcDef).errors).toEqual(
      expect.arrayContaining([
        'STREAM_NOT_FOUND',
        'STUDENT_WRONG_ENROLLMENT_KEY',
        'STUDENT_ALREADY_STUDYING',
        'STUDENT_PREREQUISITE_NOT_PASSED',
        'STUDENT_NO_STEPS',
      ]),
    );
  });

  it('правила зачисления в порядке legacy', () => {
    expect((EnrollStudentUcDef.rules ?? []).map((r) => r.name)).toEqual([
      'enrollmentKeyAccepted',
      'notStudyingElsewhere',
      'prerequisitePassed',
      'streamHasSteps',
    ]);
  });

  it('вход { streamId, enrollmentKey? } без userId (С3): субъект зачисляется сам', () => {
    const { input } = EnrollStudentUcDef;
    expect(v.parse(input, { streamId: STREAM })).toEqual({ streamId: STREAM });
    expect(v.parse(input, { streamId: STREAM, enrollmentKey: 'к' })).toEqual({
      streamId: STREAM,
      enrollmentKey: 'к',
    });
    expect(v.parse(input, { streamId: STREAM, userId: USER })).toEqual({
      streamId: STREAM,
    });
    expect(ok(input, { streamId: 'x' })).toBe(false);
    expect(ok(input, {})).toBe(false);
  });

  it('выход — { studentId }', () => {
    expect(v.parse(EnrollStudentUcDef.output, { studentId: STUDENT })).toEqual({
      studentId: STUDENT,
    });
    expect(ok(EnrollStudentUcDef.output, { studentId: 'x' })).toBe(false);
  });
});

describe('CompleteStepUcDef', () => {
  it('command пользователя: Policy isSelf (Т8), без событий', () => {
    expect(normalize(CompleteStepUcDef)).toMatchObject({
      name: 'completeStep',
      type: 'command',
      aggregate: 'student',
      callers: ['user'],
      emits: [],
    });
    expect(CompleteStepUcDef.policy).toBe(StudentPolicy.rules.isSelf);
    expect(normalize(CompleteStepUcDef).errors).toEqual(
      expect.arrayContaining([
        'STUDENT_NOT_FOUND',
        'STREAM_NOT_FOUND',
        'STUDENT_STEP_NOT_IN_STREAM',
        'STUDENT_STEP_NOT_ISSUED',
      ]),
    );
  });

  it('вход { studentId, streamId, stepId }', () => {
    const input = { studentId: STUDENT, streamId: STREAM, stepId: STEP };
    expect(v.parse(CompleteStepUcDef.input, input)).toEqual(input);
    expect(ok(CompleteStepUcDef.input, { ...input, stepId: 'x' })).toBe(false);
  });

  it.each([
    { level: 'step', currentStepId: STEP },
    { level: 'lesson', currentStepId: STEP, completedLessonId: STEP },
    { level: 'project', currentStepId: STEP, completedProjectId: STEP },
    { level: 'stream', completed: true },
    { level: 'already_completed', currentStepId: STEP },
  ])('выход: уровень %o', (out) => {
    expect(ok(CompleteStepUcDef.output, out)).toBe(true);
  });

  it('выход: чужой уровень и неполный lesson отклоняются', () => {
    expect(ok(CompleteStepUcDef.output, { level: 'x' })).toBe(false);
    expect(
      ok(CompleteStepUcDef.output, { level: 'lesson', currentStepId: STEP }),
    ).toBe(false);
  });
});

describe('CompleteStudentUcDef', () => {
  it('command пользователя: Policy canComplete, событие completed', () => {
    expect(normalize(CompleteStudentUcDef)).toMatchObject({
      name: 'completeStudent',
      type: 'command',
      aggregate: 'student',
      callers: ['user'],
      emits: ['stream.student.completed'],
    });
    expect(CompleteStudentUcDef.policy).toBe(StudentPolicy.rules.canComplete);
    expect(normalize(CompleteStudentUcDef).errors).toEqual(
      expect.arrayContaining([
        'STUDENT_NOT_FOUND',
        'STREAM_NOT_FOUND',
        'STUDENT_NOT_COMPLETABLE',
      ]),
    );
  });

  it('вход: исход advanced | not_advanced; abandoned больше не принимается', () => {
    const base = { streamId: STREAM, studentId: STUDENT };
    const { input } = CompleteStudentUcDef;
    expect(ok(input, { ...base, outcome: 'advanced' })).toBe(true);
    expect(ok(input, { ...base, outcome: 'not_advanced' })).toBe(true);
    expect(ok(input, { ...base, outcome: 'abandoned' })).toBe(false);
    expect(ok(input, base)).toBe(false);
  });

  it('выход пуст', () => {
    expect(v.parse(CompleteStudentUcDef.output, {})).toEqual({});
  });
});

describe('DropStudentUcDef', () => {
  it('command пользователя: Policy isSelf, событие abandoned', () => {
    expect(normalize(DropStudentUcDef)).toMatchObject({
      name: 'dropStudent',
      type: 'command',
      aggregate: 'student',
      callers: ['user'],
      emits: ['stream.student.abandoned'],
    });
    expect(DropStudentUcDef.policy).toBe(StudentPolicy.rules.isSelf);
    expect(normalize(DropStudentUcDef).errors).toEqual(
      expect.arrayContaining(['STUDENT_NOT_FOUND', 'STUDENT_NOT_STUDYING']),
    );
  });

  it('вход { streamId, studentId }, выход пуст', () => {
    const input = { streamId: STREAM, studentId: STUDENT };
    expect(v.parse(DropStudentUcDef.input, input)).toEqual(input);
    expect(v.parse(DropStudentUcDef.output, {})).toEqual({});
  });
});

describe('MarkAbandonedUcDef', () => {
  it('command пользователя: Policy canMarkAbandoned, событие abandoned', () => {
    expect(normalize(MarkAbandonedUcDef)).toMatchObject({
      name: 'markAbandoned',
      type: 'command',
      aggregate: 'student',
      callers: ['user'],
      emits: ['stream.student.abandoned'],
    });
    expect(MarkAbandonedUcDef.policy).toBe(
      StudentPolicy.rules.canMarkAbandoned,
    );
    expect(normalize(MarkAbandonedUcDef).errors).toEqual(
      expect.arrayContaining([
        'STUDENT_NOT_FOUND',
        'STREAM_NOT_FOUND',
        'STUDENT_NOT_STUDYING',
      ]),
    );
  });

  it('вход: причина inactivity | by_mentor; voluntary не принимается', () => {
    const base = { streamId: STREAM, studentId: STUDENT };
    const { input } = MarkAbandonedUcDef;
    expect(ok(input, { ...base, cause: 'inactivity' })).toBe(true);
    expect(ok(input, { ...base, cause: 'by_mentor' })).toBe(true);
    expect(ok(input, { ...base, cause: 'voluntary' })).toBe(false);
    expect(ok(input, base)).toBe(false);
  });
});

describe('запросы студента', () => {
  it('getStudentByUser: query пользователя, allowAll, NOT_FOUND, выход — StudentView', () => {
    expect(normalize(GetStudentByUserUcDef)).toMatchObject({
      name: 'getStudentByUser',
      type: 'query',
      aggregate: 'student',
      callers: ['user'],
      errors: ['STUDENT_NOT_FOUND'],
    });
    expect(GetStudentByUserUcDef.policy.op).toBe('allowAll');
    expect(v.parse(GetStudentByUserUcDef.input, { userId: USER })).toEqual({
      userId: USER,
    });
    expect(ok(GetStudentByUserUcDef.output, view)).toBe(true);
  });

  it('getStudentProgress: query для user и guest, allowAll, NOT_FOUND', () => {
    expect(normalize(GetStudentProgressUcDef)).toMatchObject({
      name: 'getStudentProgress',
      type: 'query',
      aggregate: 'student',
      callers: ['user', 'guest'],
      errors: ['STUDENT_NOT_FOUND'],
    });
    expect(GetStudentProgressUcDef.policy.op).toBe('allowAll');
  });

  it('getStudentProgress: stepId и lessonId необязательны', () => {
    const { input } = GetStudentProgressUcDef;
    expect(ok(input, { studentId: STUDENT })).toBe(true);
    expect(
      ok(input, { studentId: STUDENT, stepId: STEP, lessonId: STEP }),
    ).toBe(true);
    expect(ok(input, { studentId: 'x' })).toBe(false);
  });

  it('getStudentProgress: выход — студент и необязательный progress', () => {
    const { output } = GetStudentProgressUcDef;
    expect(ok(output, { student: view })).toBe(true);
    expect(ok(output, {})).toBe(false);
  });

  it('getActiveStudent: query для user и guest, allowAll, без ошибок', () => {
    expect(normalize(GetActiveStudentUcDef)).toMatchObject({
      name: 'getActiveStudent',
      type: 'query',
      aggregate: 'student',
      callers: ['user', 'guest'],
      errors: [],
    });
    expect(GetActiveStudentUcDef.policy.op).toBe('allowAll');
    expect(ok(GetActiveStudentUcDef.input, { userId: USER })).toBe(true);
    expect(ok(GetActiveStudentUcDef.output, {})).toBe(true);
    expect(ok(GetActiveStudentUcDef.output, { student: view })).toBe(true);
  });
});

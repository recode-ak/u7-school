import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from 'dmg-core/testing';
import { StepCompletionDcs } from './step-completion.dcs';
import { StreamAr } from './stream/stream.ar';
import { stored as streamStored } from './stream/stream.fixture';
import { StudentAr } from './student/student.ar';
import { stored, T0, T1 } from './student/student.fixture';

// Перенос `StreamDs.completeStep` / `tryIssueTailStep` (stream-ds.test.ts):
// уровни step | lesson | project | stream, already_completed, «хвост» расширенного
// снимка. `stepPlace` спрашивается до `student.completeStep` (как в legacy).

const P1 = '55555555-5555-4555-8555-555555555555';
const P2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const L11 = '66666666-6666-4666-8666-666666666666';
const L12 = '99999999-9999-4999-8999-999999999999';
const L21 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const S11a = '77777777-7777-4777-8777-777777777777';
const S11b = '88888888-8888-4888-8888-888888888888';
const S12 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const S21 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const NEW_P = 'e0000000-0000-4000-8000-000000000003';
const NEW_L = 'e0000000-0000-4000-8000-000000000004';
const NEW_S = 'e0000000-0000-4000-8000-000000000002';

const small = [
  {
    projectId: P1,
    projectTitle: 'П1',
    lessons: [{ lessonId: L11, lessonTitle: 'У1', stepIds: [S11a, S11b] }],
  },
];
const multi = [
  {
    projectId: P1,
    projectTitle: 'П1',
    lessons: [
      { lessonId: L11, lessonTitle: 'У1.1', stepIds: [S11a, S11b] },
      { lessonId: L12, lessonTitle: 'У1.2', stepIds: [S12] },
    ],
  },
  {
    projectId: P2,
    projectTitle: 'П2',
    lessons: [{ lessonId: L21, lessonTitle: 'У2.1', stepIds: [S21] }],
  },
];

const streamOf = (contentSnapshot: typeof small) =>
  StreamAr.restore(streamStored('active', { contentSnapshot }));
/** Студент с выданным первым шагом. */
const studentAt = (stepId: string, extra = {}) =>
  StudentAr.restore(
    stored('active', {
      currentStepId: stepId,
      steps: [{ stepId, status: 'issued', issuedAt: T0 }],
      ...extra,
    }),
  );

const run = (s: StreamAr, st: StudentAr, stepId: string) =>
  StepCompletionDcs.completeStep(s, st, stepId, T1);

describe('StepCompletionDcs.completeStep — уровни', () => {
  it('step: следующий шаг в том же уроке', () => {
    const st = studentAt(S11a);
    expect(expectOk(run(streamOf(multi), st, S11a))).toEqual({
      level: 'step',
      currentStepId: S11b,
    });
    expect(st.snapshot().currentStepId).toBe(S11b);
  });

  it('lesson: последний шаг урока, не последнего в проекте', () => {
    expect(expectOk(run(streamOf(multi), studentAt(S11b), S11b))).toEqual({
      level: 'lesson',
      currentStepId: S12,
      completedLessonId: L11,
    });
  });

  it('project: последний шаг последнего урока проекта', () => {
    expect(expectOk(run(streamOf(multi), studentAt(S12), S12))).toEqual({
      level: 'project',
      currentStepId: S21,
      completedProjectId: P1,
    });
  });

  it('stream: последний шаг потока; статус студента не меняется', () => {
    const st = studentAt(S21);
    expect(expectOk(run(streamOf(multi), st, S21))).toEqual({
      level: 'stream',
      completed: true,
    });
    expect(st.snapshot().status).toBe('active');
  });
});

describe('StepCompletionDcs.completeStep — отказы и повторы', () => {
  it('шага нет в потоке — STUDENT_STEP_NOT_IN_STREAM (проверяется раньше «не выдан»)', () => {
    const st = studentAt(S11a);
    const error = expectErr(
      run(streamOf(small), st, S21),
      'STUDENT_STEP_NOT_IN_STREAM',
    );
    expect(error.kind).toBe('validation');
    expect(st.snapshot().steps).toHaveLength(1);
  });

  it('шаг в потоке, но студенту не выдан — STUDENT_STEP_NOT_ISSUED', () => {
    expectErr(
      run(streamOf(small), studentAt(S11a), S11b),
      'STUDENT_STEP_NOT_ISSUED',
    );
  });

  it('повтор завершённого шага — already_completed с currentStepId студента', () => {
    const st = studentAt(S11a);
    expectOk(run(streamOf(small), st, S11a));
    expect(expectOk(run(streamOf(small), st, S11a))).toEqual({
      level: 'already_completed',
      currentStepId: S11b,
    });
    expect(st.snapshot().steps).toHaveLength(2);
  });
});

describe('StepCompletionDcs.completeStep — хвост расширенного снимка', () => {
  const extended = [
    ...small,
    {
      projectId: NEW_P,
      projectTitle: 'П2',
      lessons: [{ lessonId: NEW_L, lessonTitle: 'У2', stepIds: [NEW_S] }],
    },
  ];

  /** Студент прошёл всю программу `small` и «завис» на хвосте. */
  const finished = () => {
    const st = studentAt(S11a);
    expectOk(run(streamOf(small), st, S11a));
    expect(expectOk(run(streamOf(small), st, S11b))).toEqual({
      level: 'stream',
      completed: true,
    });
    return st;
  };

  it('проект расширен — выдаётся первый шаг нового проекта, уровень project', () => {
    const st = finished();
    expect(expectOk(run(streamOf(extended), st, S11b))).toEqual({
      level: 'project',
      currentStepId: NEW_S,
      completedProjectId: P1,
    });
    expect(st.snapshot().currentStepId).toBe(NEW_S);
    expect(st.snapshot().steps.find((s) => s.stepId === NEW_S)?.status).toBe(
      'issued',
    );
  });

  it('расширение внутри проекта — уровень lesson', () => {
    const inProject = [
      {
        projectId: P1,
        projectTitle: 'П1',
        lessons: [
          { lessonId: L11, lessonTitle: 'У1.1', stepIds: [S11a, S11b] },
          { lessonId: L12, lessonTitle: 'У1.2', stepIds: [S12] },
        ],
      },
    ];
    const st = finished();
    expect(expectOk(run(streamOf(inProject), st, S11b))).toEqual({
      level: 'lesson',
      currentStepId: S12,
      completedLessonId: L11,
    });
  });

  it('снимок не расширялся — already_completed, шаг не выдаётся', () => {
    const st = finished();
    expect(expectOk(run(streamOf(small), st, S11b))).toEqual({
      level: 'already_completed',
      currentStepId: S11b,
    });
    expect(st.snapshot().steps).toHaveLength(2);
  });

  it('хвостовой шаг уже выдан — already_completed (дубля нет)', () => {
    const st = finished();
    expectOk(run(streamOf(extended), st, S11b));
    const again = expectOk(run(streamOf(extended), st, S11b));
    expect(again.level).toBe('already_completed');
    expect(st.snapshot().steps.filter((s) => s.stepId === NEW_S)).toHaveLength(
      1,
    );
  });
});

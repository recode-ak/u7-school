import { describe, expect, it } from 'bun:test';
import { StudentAr } from './student/student.ar';
import { stored } from './student/student.fixture';
import type { StudentState } from './student/student.state';
import { StudentProgressDqs } from './student-progress.dqs';

// Перенос расчётов `StreamDs` (stream-ds.test.ts): computeProgress,
// buildNavigationTree, buildLessonSteps, computeProjectLevelProgress,
// computeStreamProjectProgress, getStepLessonProgress, computeStepTimeStats,
// computeAvgTime, computeStudentRowSummary, computeStudentCard, stepPosition.
// Вход — студент (`StudentAr`) и снимок контента; даты — числа UTC.

const P1 = '55555555-5555-4555-8555-555555555555';
const P2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const L11 = '66666666-6666-4666-8666-666666666666';
const L12 = '99999999-9999-4999-8999-999999999999';
const L21 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const A = '77777777-7777-4777-8777-777777777777';
const B = '88888888-8888-4888-8888-888888888888';
const C = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const UNKNOWN = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

// П1: У1.1 [A, B], У1.2 [C]; П2: У2.1 [D]
const snapshot = [
  {
    projectId: P1,
    projectTitle: 'П1',
    lessons: [
      { lessonId: L11, lessonTitle: 'У1.1', stepIds: [A, B] },
      { lessonId: L12, lessonTitle: 'У1.2', stepIds: [C] },
    ],
  },
  {
    projectId: P2,
    projectTitle: 'П2',
    lessons: [{ lessonId: L21, lessonTitle: 'У2.1', stepIds: [D] }],
  },
];

type Snapshot = typeof snapshot;

const MIN = 60_000;
const T = Date.UTC(2026, 7, 1, 10);
type Step = StudentState['steps'][number];
const done = (stepId: string, minutes = 1): Step => ({
  stepId,
  status: 'completed',
  issuedAt: T,
  completedAt: T + minutes * MIN,
});
const open = (stepId: string): Step => ({
  stepId,
  status: 'issued',
  issuedAt: T,
});
const studentOf = (steps: Step[], extra: Partial<StudentState> = {}) =>
  StudentAr.restore(
    stored('active', {
      steps,
      currentStepId: steps.at(-1)?.stepId ?? A,
      ...extra,
    }),
  );

/** DQS над снимком (по умолчанию — полный `snapshot`) и студентом. */
const dqs = (student: StudentAr, snap: Snapshot = snapshot) =>
  new StudentProgressDqs(snap, student);

describe('StudentProgressDqs.computeProgress', () => {
  it('0/4 — только начал', () => {
    expect(dqs(studentOf([open(A)])).computeProgress()).toEqual({
      completed: 0,
      total: 4,
      percent: 0,
    });
  });

  it('3/4 — многопроектный', () => {
    expect(
      dqs(studentOf([done(A), done(B), done(C), open(D)])).computeProgress(),
    ).toEqual({ completed: 3, total: 4, percent: 75 });
  });

  it('частичный снимок: шаги чужих проектов не считаются', () => {
    const only = snapshot.slice(1);
    expect(dqs(studentOf([done(A), done(D)]), only).computeProgress()).toEqual({
      completed: 1,
      total: 1,
      percent: 100,
    });
  });

  it('пустой снимок — 0/0, 0%', () => {
    expect(dqs(studentOf([]), []).computeProgress()).toEqual({
      completed: 0,
      total: 0,
      percent: 0,
    });
  });
});

describe('StudentProgressDqs.buildNavigationTree', () => {
  it('без активности все узлы locked', () => {
    const tree = dqs(studentOf([])).buildNavigationTree();
    expect(tree.projects.map((p) => p.status)).toEqual(['locked', 'locked']);
    expect(tree.projects[0]?.lessons[0]?.steps).toEqual([
      { stepId: A, status: 'locked', index: 1 },
      { stepId: B, status: 'locked', index: 2 },
    ]);
  });

  it('1/2 шагов: шаг completed, выданный current, урок и проект current', () => {
    const tree = dqs(studentOf([done(A), open(B)])).buildNavigationTree();
    const lesson = tree.projects[0]?.lessons[0];
    expect(lesson?.steps.map((s) => s.status)).toEqual([
      'completed',
      'current',
    ]);
    expect(lesson).toMatchObject({
      status: 'current',
      completedSteps: 1,
      totalSteps: 2,
    });
    expect(tree.projects[0]).toMatchObject({
      title: 'П1',
      status: 'current',
      completedLessons: 1,
      totalLessons: 2,
    });
    expect(tree.projects[1]?.status).toBe('locked');
  });

  it('всё пройдено — проекты completed', () => {
    const tree = dqs(
      studentOf([done(A), done(B), done(C), done(D)]),
    ).buildNavigationTree();
    expect(tree.projects.map((p) => p.status)).toEqual([
      'completed',
      'completed',
    ]);
  });
});

describe('StudentProgressDqs.buildLessonSteps', () => {
  it('шаги урока: completed + current, невыданный — locked, индексы 1-based, заголовки', () => {
    const view = dqs(studentOf([done(A), open(B)])).buildLessonSteps(L11);
    expect(view).toEqual({
      lessonTitle: 'У1.1',
      lessonIndex: 1,
      projectTitle: 'П1',
      projectIndex: 1,
      steps: [
        { stepId: A, status: 'completed', index: 1 },
        { stepId: B, status: 'current', index: 2 },
      ],
    });
    const locked = dqs(studentOf([done(A)])).buildLessonSteps(L11);
    expect(locked?.steps.map((s) => s.status)).toEqual(['completed', 'locked']);
  });

  it('урока нет — null', () => {
    expect(dqs(studentOf([])).buildLessonSteps(UNKNOWN)).toBeNull();
  });
});

describe('StudentProgressDqs.computeProjectLevelProgress', () => {
  it('0/2 — нет завершённых уроков', () => {
    expect(dqs(studentOf([done(A)])).computeProjectLevelProgress(0)).toEqual({
      completed: 0,
      total: 2,
      percent: 0,
    });
  });

  it('урок завершён, когда завершены все его шаги', () => {
    expect(
      dqs(studentOf([done(A), done(B)])).computeProjectLevelProgress(0),
    ).toEqual({ completed: 1, total: 2, percent: 50 });
  });

  it('индекса проекта нет — 0/0', () => {
    expect(dqs(studentOf([])).computeProjectLevelProgress(9)).toEqual({
      completed: 0,
      total: 0,
      percent: 0,
    });
  });
});

describe('StudentProgressDqs.computeStreamProjectProgress', () => {
  it('0/2, 1/2, 2/2', () => {
    const f = (steps: Step[]) =>
      dqs(studentOf(steps)).computeStreamProjectProgress();
    expect(f([done(A)])).toEqual({ completed: 0, total: 2, percent: 0 });
    expect(f([done(A), done(B), done(C)])).toEqual({
      completed: 1,
      total: 2,
      percent: 50,
    });
    expect(f([done(A), done(B), done(C), done(D)])).toEqual({
      completed: 2,
      total: 2,
      percent: 100,
    });
  });
});

describe('StudentProgressDqs.getStepLessonProgress', () => {
  it('считает завершённые шаги своего урока', () => {
    expect(dqs(studentOf([done(A), done(C)])).getStepLessonProgress(A)).toEqual(
      { completed: 1, total: 2, percent: 50 },
    );
  });

  it('урок ищется по шагу, а не по заголовку (одноимённые уроки)', () => {
    const twins = [
      {
        projectId: P1,
        projectTitle: 'П1',
        lessons: [{ lessonId: L11, lessonTitle: 'Урок', stepIds: [A] }],
      },
      {
        projectId: P2,
        projectTitle: 'П2',
        lessons: [{ lessonId: L21, lessonTitle: 'Урок', stepIds: [B, C] }],
      },
    ];
    expect(dqs(studentOf([done(B)]), twins).getStepLessonProgress(C)).toEqual({
      completed: 1,
      total: 2,
      percent: 50,
    });
  });

  it('неизвестный шаг — нулевой прогресс', () => {
    expect(dqs(studentOf([])).getStepLessonProgress(UNKNOWN)).toEqual({
      completed: 0,
      total: 0,
      percent: 0,
    });
  });
});

describe('StudentProgressDqs.stepPosition', () => {
  it('индексы и заголовки (1-based) и размер урока; неизвестный шаг — null', () => {
    expect(dqs(studentOf([])).stepPosition(C)).toMatchObject({
      projectIndex: 1,
      projectTitle: 'П1',
      lessonIndex: 2,
      lessonTitle: 'У1.2',
    });
    expect(dqs(studentOf([])).stepPosition(UNKNOWN)).toBeNull();
  });
});

describe('StudentProgressDqs.computeStepTimeStats', () => {
  it('нет шагов → все нули; незавершённые пропускаются', () => {
    expect(dqs(studentOf([])).computeStepTimeStats()).toEqual({
      runner: 0,
      fast: 0,
      normal: 0,
      deep: 0,
    });
    expect(dqs(studentOf([open(A)])).computeStepTimeStats()).toEqual({
      runner: 0,
      fast: 0,
      normal: 0,
      deep: 0,
    });
  });

  it('границы: <1 мин runner, 1–5 fast, 5–15 normal, ≥15 deep', () => {
    const stats = (minutes: number) =>
      dqs(studentOf([done(A, minutes)])).computeStepTimeStats();
    expect(stats(0.5)).toMatchObject({ runner: 1 });
    expect(stats(1)).toMatchObject({ fast: 1 });
    expect(stats(5)).toMatchObject({ normal: 1 });
    expect(stats(15)).toMatchObject({ deep: 1 });
    expect(stats(20)).toMatchObject({ deep: 1 });
  });
});

describe('StudentProgressDqs.computeAvgTime', () => {
  it('нет завершённых → null/null', () => {
    expect(dqs(studentOf([open(A)])).computeAvgTime()).toEqual({
      medianMinutes: null,
      dominant: null,
    });
  });

  it('один шаг за 2 минуты → медиана 2, доминанта Спринтер', () => {
    const res = dqs(studentOf([done(A, 2)])).computeAvgTime();
    expect(res.medianMinutes).toBe(2);
    expect(res.dominant).toMatchObject({ emoji: '⚡', name: 'Спринтер' });
  });

  it('медиана двух шагов (1 и 5 минут) — 3', () => {
    expect(
      dqs(studentOf([done(A, 1), done(B, 5)])).computeAvgTime().medianMinutes,
    ).toBe(3);
  });
});

describe('StudentProgressDqs.computeStudentRowSummary', () => {
  it('2 из 4 шагов — 50%, медиана и доминирующая категория; без шагов — 0%, времени нет', () => {
    const res = dqs(
      studentOf([done(A, 2), done(B, 2)]),
    ).computeStudentRowSummary();
    expect(res.progress).toEqual({ completed: 2, total: 4, percent: 50 });
    expect(res.medianTimeMinutes).toBe(2);
    expect(res.dominantCategory).toMatchObject({ name: 'Спринтер', count: 2 });
    expect(dqs(studentOf([])).computeStudentRowSummary()).toEqual({
      progress: { completed: 0, total: 4, percent: 0 },
      medianTimeMinutes: null,
      dominantCategory: null,
    });
  });
});

describe('StudentProgressDqs.computeStudentCard', () => {
  it('прогресс модуля и текущего проекта, урок, время, lag из аргумента', () => {
    const card = dqs(
      studentOf([done(A, 3), open(B)], { currentStepId: B }),
    ).computeStudentCard({ lagLevel: 'lagging', hoursSinceLastActivity: 2 });
    expect(card.moduleProgress).toEqual({
      completed: 1,
      total: 4,
      percent: 25,
    });
    expect(card.currentProject).toEqual({
      title: 'П1',
      progress: { completed: 0, total: 2, percent: 0 },
    });
    expect(card.currentLesson).toEqual({ title: 'У1.1' });
    expect(card.medianTimeMinutes).toBe(3);
    expect(card.timeCategories).toHaveLength(4);
    expect(card.lagLevel).toBe('lagging');
    expect(card.hoursSinceLastActivity).toBe(2);
  });

  it('без lag-аргумента: on_track и 0 часов', () => {
    const card = dqs(studentOf([])).computeStudentCard();
    expect(card.lagLevel).toBe('on_track');
    expect(card.hoursSinceLastActivity).toBe(0);
  });

  it('текущего шага нет в снимке — без проекта и урока', () => {
    const card = dqs(
      studentOf([], { currentStepId: UNKNOWN }),
    ).computeStudentCard();
    expect(card.currentProject).toBeUndefined();
    expect(card.currentLesson).toBeUndefined();
    expect(card.medianTimeMinutes).toBeNull();
  });
});

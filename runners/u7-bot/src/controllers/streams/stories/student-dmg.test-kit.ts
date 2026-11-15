import type { StudentProgress } from '@u7-scl/domain/stream/contract';
import { refuse, type UcAnswers } from './stream-dmg.test-kit';

/**
 * Фальшивый ответ UC студента для тестов stories: фикстуры в прежней форме
 * (ISO-даты, `status`) превращаются в `StudentView`, а проекции
 * `getStudentProgress` считаются по снимку контента так же, как это делает
 * `StudentProgressDqs` (stories видят только контракт, DQS им недоступна).
 */

/** Запись студента в прежней форме фикстур. */
export interface LegacyStudent {
  uuid: string;
  streamId: string;
  userId: string;
  enrolledAt?: number;
  status: 'enrolled' | 'active' | 'abandoned' | 'advanced' | 'not_advanced';
  currentStepId: string | null;
  steps: Array<{
    stepId: string;
    status: 'issued' | 'completed';
    issuedAt?: number;
    completedAt?: number;
  }>;
  createdAt?: number;
  abandonDetails?: { who: 'self' | 'mentor'; cause: string };
}

type Snapshot = Array<{
  projectId: string;
  projectTitle: string;
  lessons: Array<{ lessonId: string; lessonTitle: string; stepIds: string[] }>;
}>;

/** Дата фикстур, где поле опущено. */
const DEFAULT_AT = Date.parse('2026-01-01T00:00:00.000Z');

/** `StudentView` по записи в прежней форме. */
export function studentView(input: LegacyStudent) {
  // фикстуры могут опускать шаги
  const s = { ...input, steps: input.steps ?? [] };
  const inProgress = s.status === 'enrolled' || s.status === 'active';
  const hasCompleted = s.steps.some(
    (x) => s.status && x.status === 'completed',
  );
  const signs: string[] = [];
  let category: 'completed' | 'abandoned' | 'in_progress' = 'in_progress';
  if (s.status === 'advanced' || s.status === 'not_advanced') {
    category = 'completed';
    signs.push(s.status === 'advanced' ? 'passed' : 'not_passed');
  } else if (s.status === 'abandoned') {
    category = 'abandoned';
    if (!hasCompleted) signs.push('never_started');
    const cause = s.abandonDetails?.cause;
    if (cause === 'voluntary') signs.push('left_voluntarily');
    else if (cause === 'by_mentor' || cause === 'inactivity')
      signs.push('removed_by_mentor');
  }
  return {
    uuid: s.uuid,
    streamId: s.streamId,
    userId: s.userId,
    currentStepId: s.currentStepId ?? '',
    enrolledAt: s.enrolledAt ?? DEFAULT_AT,
    status: s.status,
    abandonDetails: s.abandonDetails,
    steps: s.steps.map((x) => ({
      stepId: x.stepId,
      status: x.status,
      issuedAt: x.issuedAt ?? DEFAULT_AT,
      completedAt: x.completedAt,
    })),
    createdAt: s.createdAt ?? DEFAULT_AT,
    updatedAt: s.createdAt ?? DEFAULT_AT,
    version: 0,
    outcome: { category, signs },
    inProgress,
    enrolled: s.status === 'enrolled',
    neverStarted: s.status === 'abandoned' && !hasCompleted,
    passed: s.status === 'advanced',
  };
}

const progressOf = (completed: number, total: number) => ({
  completed,
  total,
  percent: total > 0 ? Math.round((completed / total) * 100) : 0,
});

const CATEGORIES = [
  { emoji: '🏃', name: 'Бегун' },
  { emoji: '⚡', name: 'Спринтер' },
  { emoji: '🐢', name: 'Вдумчивый' },
  { emoji: '📚', name: 'Исследователь' },
];

/** Проекции `getStudentProgress.progress` по снимку и записи студента. */
export function progressProjection(
  snapshot: Snapshot,
  s: LegacyStudent,
  opts: { stepId?: string; lessonId?: string } = {},
): NonNullable<StudentProgress['progress']> {
  const done = new Set(
    s.steps.filter((x) => x.status === 'completed').map((x) => x.stepId),
  );
  const issued = new Set(
    s.steps.filter((x) => x.status === 'issued').map((x) => x.stepId),
  );
  const inSnapshot = new Set(
    snapshot.flatMap((p) => p.lessons.flatMap((l) => l.stepIds)),
  );
  const nodes = (ids: string[]) =>
    ids.map((stepId, i) => ({
      stepId,
      index: i + 1,
      status: done.has(stepId)
        ? ('completed' as const)
        : issued.has(stepId)
          ? ('current' as const)
          : ('locked' as const),
    }));

  const tree = {
    projects: snapshot.map((project) => {
      let completedLessons = 0;
      let hasCurrent = false;
      const lessons = project.lessons.map((lesson) => {
        const steps = nodes(lesson.stepIds);
        const completedSteps = steps.filter(
          (x) => x.status === 'completed',
        ).length;
        const hasCurrentStep = steps.some((x) => x.status === 'current');
        if (completedSteps > 0) completedLessons++;
        if (hasCurrentStep) hasCurrent = true;
        return {
          lessonId: lesson.lessonId,
          title: lesson.lessonTitle,
          status: steps.every((x) => x.status === 'completed')
            ? ('completed' as const)
            : hasCurrentStep
              ? ('current' as const)
              : ('locked' as const),
          completedSteps,
          totalSteps: lesson.stepIds.length,
          steps,
        };
      });
      return {
        title: project.projectTitle,
        status:
          completedLessons === project.lessons.length && !hasCurrent
            ? ('completed' as const)
            : hasCurrent
              ? ('current' as const)
              : ('locked' as const),
        completedLessons,
        totalLessons: project.lessons.length,
        lessons,
      };
    }),
  };

  const position = (stepId: string) => {
    for (const [pi, project] of snapshot.entries()) {
      for (const [li, lesson] of project.lessons.entries()) {
        const index = lesson.stepIds.indexOf(stepId);
        if (index === -1) continue;
        return {
          projectIndex: pi + 1,
          projectTitle: project.projectTitle,
          lessonIndex: li + 1,
          lessonTitle: lesson.lessonTitle,
          stepIndex: index + 1,
          totalSteps: lesson.stepIds.length,
        };
      }
    }
    return undefined;
  };

  const moduleSteps = snapshot.reduce(
    (sum, p) => sum + p.lessons.reduce((n, l) => n + l.stepIds.length, 0),
    0,
  );
  const moduleDone = s.steps.filter(
    (x) => x.status === 'completed' && inSnapshot.has(x.stepId),
  ).length;
  const lessonDone = (ids: string[]) => ids.every((id) => done.has(id));

  const durations = s.steps
    .filter((x) => x.status === 'completed' && x.completedAt !== undefined)
    .map((x) => (x.completedAt as number) - (x.issuedAt ?? DEFAULT_AT))
    .filter((d) => d >= 0)
    .sort((a, b) => a - b);
  const counts = [0, 0, 0, 0];
  for (const d of durations) {
    const m = d / 60_000;
    const idx = m < 1 ? 0 : m < 5 ? 1 : m < 15 ? 2 : 3;
    counts[idx] = (counts[idx] ?? 0) + 1;
  }
  const mid = Math.floor(durations.length / 2);
  const medianMs =
    durations.length === 0
      ? null
      : durations.length % 2 === 0
        ? ((durations[mid - 1] ?? 0) + (durations[mid] ?? 0)) / 2
        : (durations[mid] ?? 0);

  const current = position(s.currentStepId ?? '');
  const currentProject = current
    ? snapshot[current.projectIndex - 1]
    : undefined;

  const lessonOf = (lessonId: string) => {
    for (const [pi, project] of snapshot.entries()) {
      for (const [li, lesson] of project.lessons.entries()) {
        if (lesson.lessonId !== lessonId) continue;
        return {
          lessonTitle: lesson.lessonTitle,
          lessonIndex: li + 1,
          projectTitle: project.projectTitle,
          projectIndex: pi + 1,
          steps: nodes(lesson.stepIds),
        };
      }
    }
    return undefined;
  };

  const stepLesson = (stepId: string) =>
    snapshot.flatMap((p) => p.lessons).find((l) => l.stepIds.includes(stepId));

  return {
    module: progressOf(moduleDone, moduleSteps),
    projects: progressOf(
      snapshot.filter((p) => p.lessons.every((l) => lessonDone(l.stepIds)))
        .length,
      snapshot.length,
    ),
    card: {
      moduleProgress: progressOf(moduleDone, moduleSteps),
      currentProject: current
        ? {
            title: current.projectTitle,
            progress: progressOf(
              (currentProject?.lessons ?? []).filter((l) =>
                lessonDone(l.stepIds),
              ).length,
              currentProject?.lessons.length ?? 0,
            ),
          }
        : undefined,
      currentLesson: current ? { title: current.lessonTitle } : undefined,
      medianTimeMinutes:
        medianMs === null ? null : Math.round(medianMs / 60_000),
      timeCategories: CATEGORIES.map((c, i) => ({
        ...c,
        count: counts[i] ?? 0,
      })),
      hoursSinceLastActivity: 0,
      lagLevel: 'on_track' as const,
    },
    tree,
    step:
      opts.stepId === undefined
        ? undefined
        : {
            position: position(opts.stepId),
            lessonProgress: (() => {
              const lesson = stepLesson(opts.stepId);
              return lesson
                ? progressOf(
                    lesson.stepIds.filter((id) => done.has(id)).length,
                    lesson.stepIds.length,
                  )
                : progressOf(0, 0);
            })(),
          },
    lesson: opts.lessonId === undefined ? undefined : lessonOf(opts.lessonId),
  };
}

/** Ответы `getStudentByUser` и `getStudentProgress` над записью студента. */
export function studentAnswers(
  student: LegacyStudent | undefined,
  snapshot: Snapshot,
): UcAnswers {
  return {
    getStudentByUser: () =>
      student ? studentView(student) : refuse('STUDENT_NOT_FOUND', 'not_found'),
    getStudentProgress: (input) => {
      if (!student) return refuse('STUDENT_NOT_FOUND', 'not_found');
      const { stepId, lessonId } = input as {
        stepId?: string;
        lessonId?: string;
      };
      return {
        student: studentView(student),
        progress: progressProjection(snapshot, student, { stepId, lessonId }),
      };
    },
  };
}

const HOUR_MS = 3_600_000;

/** Медиана; пустой набор — 0. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/**
 * Ответ `getStreamMembers`: студенты и отставание (`roster`) на момент `now`,
 * как считает `StreamMembersDqs.roster`: больше 7 суток — критично, больше 4
 * — отстаёт, иначе отставание на 30% от медианы учащихся.
 */
export function streamMembers(
  mentorId: string,
  students: LegacyStudent[],
  now = Date.now(),
) {
  const views = students.map(studentView);
  const hours = students.map((s) => {
    const times = (s.steps ?? []).map(
      (x) => x.completedAt ?? x.issuedAt ?? DEFAULT_AT,
    );
    return times.length === 0 ? 0 : (now - Math.max(...times)) / HOUR_MS;
  });
  const studying = median(hours.filter((_, i) => views[i]?.inProgress));
  return {
    mentorId,
    students: views.map((v) => ({
      studentId: v.uuid,
      userId: v.userId,
      status: v.status,
      neverStarted: v.neverStarted,
      inProgress: v.inProgress,
    })),
    roster: views.map((v, i) => {
      const since = hours[i] ?? 0;
      const lagLevel = !v.inProgress
        ? ('on_track' as const)
        : since > 7 * 24
          ? ('critical' as const)
          : since > 4 * 24
            ? ('lagging' as const)
            : studying > 0 && since >= studying * 1.3
              ? ('lagging' as const)
              : ('on_track' as const);
      return {
        studentId: v.uuid,
        lagLevel,
        hoursSinceLastActivity: since,
      };
    }),
  };
}

import type { ContentSnapshot } from '@u7-scl/domain/course/contract';
import type { ReadonlyAr } from 'dmg-core';
import type { StudentAr } from './student/student.ar';
import type { StepRecord } from './student/student.state';
import type {
  LagInfo,
  LessonSteps,
  NavigationTree,
  NodeStatus,
  Progress,
  StepNode,
  StepPosition,
  StepTimeStats,
  StudentCard,
  StudentRowSummary,
  TimeCategory,
} from './student/student.types';

type Student = ReadonlyAr<StudentAr>;

const MINUTE_MS = 60_000;
const NO_PROGRESS: Progress = { completed: 0, total: 0, percent: 0 };

/** Категории времени на шаг с прозвищами; порядок — как в `StepTimeStats`. */
const TIME_CATEGORIES = [
  { emoji: '🏃', name: 'Бегун' },
  { emoji: '⚡', name: 'Спринтер' },
  { emoji: '🐢', name: 'Вдумчивый' },
  { emoji: '📚', name: 'Исследователь' },
] as const;

function progressOf(completed: number, total: number): Progress {
  return {
    completed,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

function stepsOf(student: Student): StepRecord[] {
  return student.view().steps;
}

function completedIds(student: Student): Set<string> {
  return new Set(
    stepsOf(student)
      .filter((step) => step.status === 'completed')
      .map((step) => step.stepId),
  );
}

/** Статус шага в дереве: завершён / выдан (текущий) / закрыт. */
function nodesOf(stepIds: readonly string[], student: Student): StepNode[] {
  const statuses = new Map(
    stepsOf(student).map((step) => [step.stepId, step.status]),
  );
  return stepIds.map((stepId, index) => {
    const status = statuses.get(stepId);
    const node: NodeStatus =
      status === 'completed'
        ? 'completed'
        : status === 'issued'
          ? 'current'
          : 'locked';
    return { stepId, status: node, index: index + 1 };
  });
}

/**
 * Длительность завершённого шага в мс; незавершённые, отрицательные и
 * зачтённые синхронизацией (не работа студента, ФР-6а) — `undefined`.
 */
function durationOf(step: StepRecord): number | undefined {
  if (step.completedAt === undefined) return undefined;
  if (step.completionSource !== undefined) return undefined;
  const duration = step.completedAt - step.issuedAt;
  return duration < 0 ? undefined : duration;
}

function countSteps(snapshot: ContentSnapshot): number {
  return snapshot.reduce(
    (sum, p) => sum + p.lessons.reduce((s, l) => s + l.stepIds.length, 0),
    0,
  );
}

function categoriesOf(stats: StepTimeStats): TimeCategory[] {
  const counts = [stats.runner, stats.fast, stats.normal, stats.deep];
  return TIME_CATEGORIES.map((category, index) => ({
    ...category,
    count: counts[index] ?? 0,
  }));
}

/**
 * DQS: прогресс студента по снимку контента потока — прогресс, дерево
 * навигации, статистика времени, карточка. Только читает; отставание
 * приходит аргументом. Считаются только шаги, которые есть в переданном
 * снимке (полный поток или его часть).
 */
export class StudentProgressDqs {
  constructor(
    private readonly snapshot: ContentSnapshot,
    private readonly student: Student,
  ) {}

  /** Прогресс по шагам: завершено из общего числа шагов снимка. */
  computeProgress(): Progress {
    const inSnapshot = new Set(
      this.snapshot.flatMap((p) => p.lessons.flatMap((l) => l.stepIds)),
    );
    const done = stepsOf(this.student).filter(
      (step) => step.status === 'completed' && inSnapshot.has(step.stepId),
    ).length;
    return progressOf(done, countSteps(this.snapshot));
  }

  /** Дерево навигации: проекты → уроки → шаги со статусами completed/current/locked. */
  buildNavigationTree(): NavigationTree {
    return {
      projects: this.snapshot.map((project) => {
        let completedLessons = 0;
        let hasCurrent = false;
        const lessons = project.lessons.map((lesson) => {
          const steps = nodesOf(lesson.stepIds, this.student);
          const completedSteps = steps.filter(
            (s) => s.status === 'completed',
          ).length;
          const hasCurrentStep = steps.some((s) => s.status === 'current');
          if (completedSteps > 0) completedLessons++;
          if (hasCurrentStep) hasCurrent = true;
          const status: NodeStatus = steps.every(
            (s) => s.status === 'completed',
          )
            ? 'completed'
            : hasCurrentStep
              ? 'current'
              : 'locked';
          return {
            lessonId: lesson.lessonId,
            title: lesson.lessonTitle,
            status,
            completedSteps,
            totalSteps: lesson.stepIds.length,
            steps,
          };
        });
        const status: NodeStatus =
          completedLessons === project.lessons.length && !hasCurrent
            ? 'completed'
            : hasCurrent
              ? 'current'
              : 'locked';
        return {
          title: project.projectTitle,
          status,
          completedLessons,
          totalLessons: project.lessons.length,
          lessons,
        };
      }),
    };
  }

  /** Шаги урока с заголовками и индексами (с 1); урока нет — `null`. */
  buildLessonSteps(lessonId: string): LessonSteps | null {
    for (const [pi, project] of this.snapshot.entries()) {
      for (const [li, lesson] of project.lessons.entries()) {
        if (lesson.lessonId !== lessonId) continue;
        return {
          lessonTitle: lesson.lessonTitle,
          lessonIndex: li + 1,
          projectTitle: project.projectTitle,
          projectIndex: pi + 1,
          steps: nodesOf(lesson.stepIds, this.student),
        };
      }
    }
    return null;
  }

  /** Прогресс проекта: сколько его уроков завершены (все шаги урока выполнены). */
  computeProjectLevelProgress(projectIndex: number): Progress {
    const project = this.snapshot[projectIndex];
    if (!project) return NO_PROGRESS;
    const done = completedIds(this.student);
    return progressOf(
      project.lessons.filter((l) => l.stepIds.every((id) => done.has(id)))
        .length,
      project.lessons.length,
    );
  }

  /** Прогресс по проектам: сколько проектов завершены (все уроки выполнены). */
  computeStreamProjectProgress(): Progress {
    const done = completedIds(this.student);
    return progressOf(
      this.snapshot.filter((p) =>
        p.lessons.every((l) => l.stepIds.every((id) => done.has(id))),
      ).length,
      this.snapshot.length,
    );
  }

  /**
   * Прогресс в уроке шага. Урок ищется по самому шагу, а не по заголовку:
   * заголовки уроков в снимке не уникальны.
   */
  getStepLessonProgress(stepId: string): Progress {
    const lesson = this.snapshot
      .flatMap((p) => p.lessons)
      .find((l) => l.stepIds.includes(stepId));
    if (!lesson) return NO_PROGRESS;
    const done = completedIds(this.student);
    return progressOf(
      lesson.stepIds.filter((id) => done.has(id)).length,
      lesson.stepIds.length,
    );
  }

  /**
   * Позиция шага в снимке: индексы (с 1), заголовки, число шагов урока.
   * Шага нет — `null`. Свой разбор индексов шага: домен не импортирует
   * чужой индекс.
   */
  stepPosition(stepId: string): StepPosition | null {
    for (const [pi, project] of this.snapshot.entries()) {
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
    return null;
  }

  /** Сколько завершённых шагов в каждой категории времени (<1, 1–5, 5–15, ≥15 минут). */
  computeStepTimeStats(): StepTimeStats {
    const stats = { runner: 0, fast: 0, normal: 0, deep: 0 };
    for (const step of stepsOf(this.student)) {
      const duration = durationOf(step);
      if (duration === undefined) continue;
      const minutes = duration / MINUTE_MS;
      if (minutes < 1) stats.runner++;
      else if (minutes < 5) stats.fast++;
      else if (minutes < 15) stats.normal++;
      else stats.deep++;
    }
    return stats;
  }

  /** Медиана минут на шаг (устойчива к выбросам) и преобладающая категория времени. */
  computeAvgTime(): {
    medianMinutes: number | null;
    dominant: TimeCategory | null;
  } {
    const durations = stepsOf(this.student)
      .map(durationOf)
      .filter((d): d is number => d !== undefined)
      .sort((a, b) => a - b);
    if (durations.length === 0) return { medianMinutes: null, dominant: null };
    const mid = Math.floor(durations.length / 2);
    const medianMs =
      durations.length % 2 === 0
        ? ((durations[mid - 1] ?? 0) + (durations[mid] ?? 0)) / 2
        : (durations[mid] ?? 0);
    const counts = categoriesOf(this.computeStepTimeStats());
    const top = [...counts].sort((a, b) => b.count - a.count)[0];
    return {
      medianMinutes: Math.round(medianMs / MINUTE_MS),
      dominant: top && top.count > 0 ? top : null,
    };
  }

  /** Сводка студента для строки списка: прогресс, медиана времени, преобладающая категория. */
  computeStudentRowSummary(): StudentRowSummary {
    const { medianMinutes, dominant } = this.computeAvgTime();
    return {
      progress: this.computeProgress(),
      medianTimeMinutes: medianMinutes,
      dominantCategory: dominant,
    };
  }

  /**
   * Карточка студента: прогресс модуля и текущего проекта, текущий урок,
   * время по категориям. Отставание — аргумент (считает `StreamMembersDqs.roster`);
   * не задано — `on_track` и 0 часов.
   */
  computeStudentCard(lag?: LagInfo): StudentCard {
    const position = this.stepPosition(this.student.currentStepId());
    const { medianMinutes } = this.computeAvgTime();
    return {
      moduleProgress: this.computeProgress(),
      currentProject: position
        ? {
            title: position.projectTitle,
            progress: this.computeProjectLevelProgress(
              position.projectIndex - 1,
            ),
          }
        : undefined,
      currentLesson: position ? { title: position.lessonTitle } : undefined,
      medianTimeMinutes: medianMinutes,
      timeCategories: categoriesOf(this.computeStepTimeStats()),
      hoursSinceLastActivity: lag?.hoursSinceLastActivity ?? 0,
      lagLevel: lag?.lagLevel ?? 'on_track',
    };
  }
}

import type { ContentSnapshot } from '@u7-scl/domain/course/contract';
import type { PivotShift, SnapshotDiff } from './content-sync.types';

type StepAt = {
  readonly stepId: string;
  readonly lessonId: string;
  readonly projectId: string;
  readonly index: number;
};

/**
 * Шаги снимка в плоском обходе «проекты → уроки → шаги»: позиция с 1,
 * у дубликата `stepId` — первое вхождение (как `StreamAr.stepPlace`).
 */
class StepOrder {
  readonly steps: readonly StepAt[];
  private readonly byId: ReadonlyMap<string, StepAt>;

  constructor(snapshot: ContentSnapshot) {
    const byId = new Map<string, StepAt>();
    let index = 0;
    for (const project of snapshot) {
      for (const lesson of project.lessons) {
        for (const stepId of lesson.stepIds) {
          index++;
          if (byId.has(stepId)) continue;
          byId.set(stepId, {
            stepId,
            lessonId: lesson.lessonId,
            projectId: project.projectId,
            index,
          });
        }
      }
    }
    this.byId = byId;
    this.steps = [...byId.values()];
  }

  at(stepId: string): StepAt | undefined {
    return this.byId.get(stepId);
  }

  has(stepId: string): boolean {
    return this.byId.has(stepId);
  }
}

/**
 * Общие шаги, сохранившие относительный порядок: наибольшая общая
 * подпоследовательность. При равенстве длины сохраняется более ранний шаг
 * старого порядка — результат детерминирован (T11).
 */
function keptInOrder(older: readonly string[], newer: readonly string[]) {
  const n = older.length;
  const m = newer.length;
  // Длина НОП для older[i..] и newer[j..]; за границей — 0
  const table = new Uint32Array((n + 1) * (m + 1));
  const lcs = (i: number, j: number) => table[i * (m + 1) + j] ?? 0;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * (m + 1) + j] =
        older[i] === newer[j]
          ? lcs(i + 1, j + 1) + 1
          : Math.max(lcs(i + 1, j), lcs(i, j + 1));
    }
  }
  const kept = new Set<string>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const step = older[i];
    if (step !== undefined && step === newer[j]) {
      kept.add(step);
      i++;
      j++;
    } else if (lcs(i, j + 1) >= lcs(i + 1, j)) j++;
    else i++;
  }
  return kept;
}

/**
 * DQS: различия старого и нового снимка контента (F-80) — отчёт по проектам,
 * урокам и шагам и сдвиги шагов относительно опорного. Агрегатов не знает.
 */
export class SnapshotDiffDqs {
  private readonly older: StepOrder;
  private readonly newer: StepOrder;

  constructor(
    private readonly oldSnapshot: ContentSnapshot,
    private readonly newSnapshot: ContentSnapshot,
  ) {
    this.older = new StepOrder(oldSnapshot);
    this.newer = new StepOrder(newSnapshot);
  }

  /** Отчёт «было → стало»; сдвиг позиций из-за чужих добавлений — не перенос. */
  compute(): SnapshotDiff {
    const projects = this.projectChanges();
    const lessons = this.lessonChanges();
    const steps = this.stepChanges();
    const changed = [
      ...Object.values(projects),
      ...Object.values(lessons),
      ...Object.values(steps),
    ].some((list) => list.length > 0);
    return { changed, projects, lessons, steps };
  }

  /**
   * Шаги, сменившие сторону относительно `pivotStepId`: добавленные и
   * пересёкшие его. Опорного нет в старом — только добавленные; нет в новом —
   * списки пусты.
   */
  shiftsAround(pivotStepId: string): PivotShift {
    const pivotNew = this.newer.at(pivotStepId)?.index ?? null;
    const pivotOld = this.older.at(pivotStepId)?.index ?? null;
    const shift: PivotShift = {
      pivotInNew: pivotNew,
      pivotInOld: pivotOld,
      newlyBehind: [],
      newlyAhead: [],
    };
    if (pivotNew === null) return shift;
    for (const step of this.newer.steps) {
      if (step.stepId === pivotStepId) continue;
      const before = step.index < pivotNew;
      const old = this.older.at(step.stepId)?.index;
      const crossed =
        old !== undefined && pivotOld !== null && old > pivotOld === before;
      if (old !== undefined && !crossed) continue;
      (before ? shift.newlyBehind : shift.newlyAhead).push(step.stepId);
    }
    return shift;
  }

  /**
   * Следующий шаг после `stepId` в новом снимке; `undefined` — нет шага или
   * он последний. Нужен `StreamContentSyncDcs`, чтобы найти `tail` (T8).
   */
  nextInNew(stepId: string): string | undefined {
    const at = this.newer.at(stepId);
    if (at === undefined) return undefined;
    return this.newer.steps.find((step) => step.index > at.index)?.stepId;
  }

  private projectChanges(): SnapshotDiff['projects'] {
    const olds = new Map(this.oldSnapshot.map((p) => [p.projectId, p]));
    const news = new Map(this.newSnapshot.map((p) => [p.projectId, p]));
    const titled = (p: ContentSnapshot[number]) => ({
      projectId: p.projectId,
      title: p.projectTitle,
    });
    return {
      added: [...news.values()]
        .filter((p) => !olds.has(p.projectId))
        .map(titled),
      removed: [...olds.values()]
        .filter((p) => !news.has(p.projectId))
        .map(titled),
      renamed: [...news.values()].flatMap((p) => {
        const was = olds.get(p.projectId);
        return was === undefined || was.projectTitle === p.projectTitle
          ? []
          : [
              {
                projectId: p.projectId,
                from: was.projectTitle,
                to: p.projectTitle,
              },
            ];
      }),
    };
  }

  private lessonChanges(): SnapshotDiff['lessons'] {
    const lessonsOf = (snapshot: ContentSnapshot) =>
      new Map(
        snapshot.flatMap((p) =>
          p.lessons.map((l) => [
            l.lessonId,
            {
              lessonId: l.lessonId,
              projectId: p.projectId,
              title: l.lessonTitle,
            },
          ]),
        ),
      );
    const olds = lessonsOf(this.oldSnapshot);
    const news = lessonsOf(this.newSnapshot);
    return {
      added: [...news.values()].filter((l) => !olds.has(l.lessonId)),
      removed: [...olds.values()].filter((l) => !news.has(l.lessonId)),
      renamed: [...news.values()].flatMap((l) => {
        const was = olds.get(l.lessonId);
        return was === undefined || was.title === l.title
          ? []
          : [{ lessonId: l.lessonId, from: was.title, to: l.title }];
      }),
    };
  }

  private stepChanges(): SnapshotDiff['steps'] {
    const common = (order: StepOrder, other: StepOrder) =>
      order.steps.filter((s) => other.has(s.stepId)).map((s) => s.stepId);
    const kept = keptInOrder(
      common(this.older, this.newer),
      common(this.newer, this.older),
    );
    const moved: SnapshotDiff['steps']['moved'] = [];
    for (const to of this.newer.steps) {
      const from = this.older.at(to.stepId);
      if (from === undefined) continue;
      const samePlace =
        from.lessonId === to.lessonId && from.projectId === to.projectId;
      if (samePlace && kept.has(to.stepId)) continue;
      moved.push({
        stepId: to.stepId,
        from: {
          projectId: from.projectId,
          lessonId: from.lessonId,
          index: from.index,
        },
        to: { projectId: to.projectId, lessonId: to.lessonId, index: to.index },
      });
    }
    return {
      added: this.newer.steps
        .filter((s) => !this.older.has(s.stepId))
        .map((s) => ({ ...s })),
      removed: this.older.steps
        .filter((s) => !this.newer.has(s.stepId))
        .map((s) => ({ ...s })),
      moved,
    };
  }
}

import type { ContentSnapshot } from '@u7-scl/domain/course/contract';
import { type ErrorOf, ok, type Result, type Timestamp } from 'dmg-core';
import type {
  ContentSyncPlan,
  StudentImpact,
  SyncBlocker,
} from './content-sync.types';
import { SnapshotDiffDqs } from './snapshot-diff.dqs';
import type { StreamAr } from './stream/stream.ar';
import { StreamErrors } from './stream/stream.errors';
import type { StudentAr } from './student/student.ar';

const {
  CONTENT_NOT_SYNCABLE,
  SYNC_REMOVES_CURRENT_STEP,
  SYNC_NEEDS_CONFIRMATION,
} = StreamErrors;

/** Отказ обновления контента: статус потока, удаление текущего шага, подтверждение. */
export type ContentSyncError =
  | ErrorOf<typeof CONTENT_NOT_SYNCABLE>
  | ErrorOf<typeof SYNC_REMOVES_CURRENT_STEP>
  | ErrorOf<typeof SYNC_NEEDS_CONFIRMATION>;

/** Итог применения: изменённых студентов регистрирует вызывающий. */
export type ContentSyncOutcome = {
  readonly mode: 'replace' | 'sync';
  readonly changedStudents: readonly StudentAr[];
  readonly credited: readonly { studentId: string; stepIds: string[] }[];
};

/**
 * Обновление контента идущего потока (F-80): план по студентам и применение —
 * зачёт шагов, оказавшихся позади, и замена снимка потока.
 * @see conductor/tracks/stream-content-sync_20261115/slices/domain.md — таблица исходов
 */
export class StreamContentSyncDcs {
  constructor(
    private readonly stream: StreamAr,
    private readonly students: readonly StudentAr[],
  ) {}

  /** План обновления до `newSnapshot`: ничего не мутирует, блокеры — внутри. */
  plan(newSnapshot: ContentSnapshot): ContentSyncPlan {
    const dqs = new SnapshotDiffDqs(
      this.stream.view().contentSnapshot,
      newSnapshot,
    );
    const diff = dqs.compute();
    if (!this.stream.canSyncContent()) {
      return {
        mode: 'refused',
        diff,
        students: [],
        affected: [],
        blockers: [{ code: 'CONTENT_NOT_SYNCABLE' }],
      };
    }
    if (this.stream.isEnrolling()) {
      return {
        mode: 'replace',
        diff,
        students: [],
        affected: [],
        blockers: [],
      };
    }
    const removed = diff.steps.removed.map((step) => step.stepId);
    const students = this.students
      .filter((student) => student.isInProgress())
      .map((student) => impactOf(student, dqs, removed));
    const blocked = students
      .filter((impact) => impact.removesCurrent)
      .map(({ studentId, userId }) => ({ studentId, userId }));
    const blockers: SyncBlocker[] =
      blocked.length > 0
        ? [{ code: 'SYNC_REMOVES_CURRENT_STEP', students: blocked }]
        : [];
    return {
      mode: 'sync',
      diff,
      students,
      affected: students
        .filter((impact) => impact.behind.length > 0)
        .map((impact) => impact.studentId),
      blockers,
    };
  }

  /**
   * Применение: план пересчитывается заново, все проверки — до мутаций.
   * Затронут неподтверждённый студент — отказ; лишние подтверждённые не
   * мешают повтору после сбоя (ФР-8а). Студенты меняются первыми, снимок
   * потока — последним.
   */
  apply(
    newSnapshot: ContentSnapshot,
    confirmedStudentIds: readonly string[],
    at: Timestamp,
  ): Result<ContentSyncOutcome, ContentSyncError> {
    const plan = this.plan(newSnapshot);
    const [blocker] = plan.blockers;
    if (blocker?.code === 'CONTENT_NOT_SYNCABLE') {
      return CONTENT_NOT_SYNCABLE.err();
    }
    if (blocker?.code === 'SYNC_REMOVES_CURRENT_STEP') {
      return SYNC_REMOVES_CURRENT_STEP.err({ students: blocker.students });
    }
    const confirmed = new Set(confirmedStudentIds);
    if (plan.affected.some((studentId) => !confirmed.has(studentId))) {
      return SYNC_NEEDS_CONFIRMATION.err({ affected: plan.affected });
    }
    const byId = new Map(this.students.map((s) => [s.view().uuid, s]));
    const changedStudents: StudentAr[] = [];
    const credited: { studentId: string; stepIds: string[] }[] = [];
    for (const impact of plan.students) {
      if (impact.behind.length === 0) continue;
      const student = byId.get(impact.studentId);
      if (student === undefined) continue;
      for (const stepId of impact.behind) student.creditStep(stepId, at);
      changedStudents.push(student);
      credited.push({ studentId: impact.studentId, stepIds: impact.behind });
    }
    const replaced = this.stream.replaceContent(newSnapshot, at);
    if (!replaced.ok) return replaced;
    return ok({
      mode: plan.mode === 'replace' ? 'replace' : 'sync',
      changedStudents,
      credited,
    });
  }
}

/**
 * Влияние на идущего студента. «Позади» — относительно текущего шага в новом
 * снимке; зачитывается только незавершённое, старые рассогласования не в счёт.
 */
function impactOf(
  student: StudentAr,
  dqs: SnapshotDiffDqs,
  removed: readonly string[],
): StudentImpact {
  const { uuid, userId, status } = student.view();
  const base = { studentId: uuid, userId, status };
  const untouched = {
    behind: [],
    ahead: [],
    completedAhead: [],
    removesCurrent: false,
  };
  if (student.hasNoSteps()) {
    return { ...base, kind: 'not_started', ...untouched, removedPassed: [] };
  }
  const removedPassed = removed.filter((stepId) => student.hasIssued(stepId));
  const current = student.currentStepId();
  const shift = dqs.shiftsAround(current);
  if (shift.pivotInNew === null) {
    return {
      ...base,
      kind: 'in_progress',
      ...untouched,
      removedPassed,
      removesCurrent: true,
    };
  }
  const open = (stepId: string) => !student.hasCompleted(stepId);
  let ahead = shift.newlyAhead.filter(open);
  // Хвост — следующий за пройденным текущим (T8): его выдаст `issueTail`
  const next = dqs.nextInNew(current);
  const tail =
    student.hasCompleted(current) && next !== undefined && ahead.includes(next)
      ? next
      : undefined;
  if (tail !== undefined) ahead = ahead.filter((stepId) => stepId !== tail);
  return {
    ...base,
    kind: 'in_progress',
    behind: shift.newlyBehind.filter(open),
    ahead,
    ...(tail !== undefined && { tail }),
    completedAhead: shift.newlyAhead.filter((stepId) => !open(stepId)),
    removedPassed,
    removesCurrent: false,
  };
}

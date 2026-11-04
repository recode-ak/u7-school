import type { ReadonlyAr, Timestamp } from 'dmg-core';
import type { StreamAr } from './stream/stream.ar';
import type { StreamStudentFact } from './stream/stream.types';
import type { StudentAr } from './student/student.ar';
import type { LagLevel, RosterEntry } from './student/student.types';

const HOUR_MS = 60 * 60 * 1000;
const DAY_HOURS = 24;
/** Часов без активности, после которых студент критически отстаёт (7 суток). */
const CRITICAL_AFTER_HOURS = 7 * DAY_HOURS;
/** Часов без активности, после которых студент отстаёт (4 суток). */
const LAGGING_AFTER_HOURS = 4 * DAY_HOURS;
/** Во сколько раз студент должен отставать от медианы, чтобы считаться отстающим. */
const MEDIAN_LAG_FACTOR = 1.3;

type Students = readonly ReadonlyAr<StudentAr>[];

/** Медиана; пустой набор — 0. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function lagLevel(hours: number, studyingMedian: number): LagLevel {
  if (hours > CRITICAL_AFTER_HOURS) return 'critical';
  if (hours > LAGGING_AFTER_HOURS) return 'lagging';
  if (studyingMedian > 0 && hours >= studyingMedian * MEDIAN_LAG_FACTOR) {
    return 'lagging';
  }
  return 'on_track';
}

/**
 * DQS: состав потока в проекциях по студентам. Только читает.
 */
export class StreamMembersDqs {
  constructor(
    private readonly stream: ReadonlyAr<StreamAr>,
    private readonly students: Students,
  ) {}

  /**
   * Факты о студентах для правила `studentsSettled` и состава потока: поток
   * спрашивает у студентов только итог, статус сырой.
   */
  facts(): StreamStudentFact[] {
    return this.students.map((student) => {
      const { userId, status } = student.view();
      return {
        studentId: student.uuid,
        userId,
        status,
        settled: student.isTerminal(),
        inProgress: student.isInProgress(),
        neverStarted: student.neverStarted(),
      };
    });
  }

  /**
   * Отставание на момент `at`: время без активности (0 — шагов нет) и
   * уровень. Критично — больше 7 суток, отстаёт — больше 4; иначе — на 30%+
   * от медианы учащихся. Ушедшие и завершившие — `on_track`.
   */
  roster(at: Timestamp): RosterEntry[] {
    const members = this.students.filter((student) =>
      student.belongsToStream(this.stream.uuid),
    );
    const hours = members.map((student) => {
      const last = student.lastActivityAt();
      return last === undefined ? 0 : (at - last) / HOUR_MS;
    });
    const studying = median(
      hours.filter((_, index) => members[index]?.isInProgress()),
    );
    return members.map((student, index) => {
      const sinceLast = hours[index] ?? 0;
      return {
        studentId: student.uuid,
        lagLevel: student.isInProgress()
          ? lagLevel(sinceLast, studying)
          : 'on_track',
        hoursSinceLastActivity: sinceLast,
      };
    });
  }
}

import {
  GetStudentProgressUcDef,
  type LagLevel,
  type Progress,
  type StudentCard,
  type StudentView,
  type TimeCategory,
} from '@u7-scl/domain/stream/contract';
import type { DomainError } from 'dmg-core';
import type { StreamDispatch } from '../learning/shared';

/** Студент потока в списке: запись, имя, прогресс и темп (проекции `getStudentProgress`). */
export interface StudentRow {
  student: StudentView;
  name: string;
  progress: Progress;
  medianTimeMinutes: number | null;
  /** Преобладающая категория времени на шаг; нет завершённых шагов — null. */
  dominantCategory: TimeCategory | null;
  lagLevel: LagLevel;
}

/** Иконка исхода студента (оформление). */
export function outcomeIcon(student: StudentView): string {
  switch (student.outcome.category) {
    case 'completed':
      return student.outcome.signs.includes('passed') ? '✅' : '↩️';
    case 'abandoned':
      return '🚫';
    case 'in_progress':
      return '🟢';
  }
}

/**
 * Подпись исхода студента. Термины унифицированы по спеке трека
 * (см. spec.md ФР-2): «окончил», «окончил, не прошёл», «забросил»,
 * «не начал», «покинул сам», «снят ментором», «учится».
 */
export function outcomeLabel(student: StudentView): string {
  const { category, signs } = student.outcome;
  switch (category) {
    case 'completed':
      return signs.includes('passed') ? 'окончил' : 'окончил, не прошёл';
    case 'abandoned':
      // Приоритет «не начал» над причиной ухода
      if (signs.includes('never_started')) return 'не начал';
      if (signs.includes('left_voluntarily')) return 'покинул сам';
      if (signs.includes('removed_by_mentor')) return 'снят ментором';
      // Легаси: abandoned с шагами, причина неизвестна
      return 'забросил';
    case 'in_progress':
      return 'учится';
  }
}

/** Маркер отставания с учётом исхода студента. */
export function lagMarker(lagLevel: LagLevel, student: StudentView): string {
  if (student.outcome.category !== 'in_progress') return outcomeIcon(student);
  if (lagLevel === 'critical') return '🛑';
  if (lagLevel === 'lagging') return '⚠️';
  return '🏃';
}

/** Преобладающая категория времени из карточки: больше всего шагов, при равенстве — первая. */
function dominantOf(card: StudentCard): TimeCategory | null {
  const top = [...card.timeCategories].sort((a, b) => b.count - a.count)[0];
  return top && top.count > 0 ? top : null;
}

/**
 * Строки списка студентов: по каждому участнику — `getStudentProgress`
 * (запись, прогресс модуля, темп) и имя. Отставание берётся из `roster`
 * состава потока (медиана по учащимся). Отказ расчёта — отказ всего списка.
 */
export async function loadStudentRows(
  dispatch: StreamDispatch,
  userName: (userId: string) => Promise<string>,
  members: ReadonlyArray<{ studentId: string; userId: string }>,
  lagById: ReadonlyMap<string, LagLevel>,
): Promise<
  { ok: true; rows: StudentRow[] } | { ok: false; error: DomainError }
> {
  const rows: StudentRow[] = [];
  for (const member of members) {
    const loaded = await dispatch(
      GetStudentProgressUcDef.command({ studentId: member.studentId }),
    );
    if (!loaded.ok) return { ok: false, error: loaded.error };
    const { student, progress } = loaded.value;
    rows.push({
      student,
      name: await userName(member.userId),
      progress: progress?.module ?? { completed: 0, total: 0, percent: 0 },
      medianTimeMinutes: progress?.card.medianTimeMinutes ?? null,
      dominantCategory: progress ? dominantOf(progress.card) : null,
      lagLevel: lagById.get(member.studentId) ?? 'on_track',
    });
  }
  return { ok: true, rows };
}

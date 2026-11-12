import { now } from '@u7-scl/core/shared';
import type { ContentSnapshot } from '@u7-scl/domain/course/contract';
import { StudentArDef, type StudentState } from '@u7-scl/domain/stream';
import * as v from 'valibot';

type Student = StudentState;
type StepRecord = Student['steps'][number];

const StudentRows = v.array(StudentArDef.state);

/**
 * Разбирает содержимое `students.json` строгой схемой Def: ISO-даты legacy
 * становятся числами, `version` и `updatedAt` дописываются (D-36). Битая
 * запись — исключение до любой записи.
 */
export function parseStudentRows(raw: unknown): Student[] {
  return v.parse(StudentRows, raw);
}

/**
 * Читает `students.json`: нет файла — пустой список; файл есть, но разбор
 * упал — исключение (`ValiError`), вызывающий останавливается до любой записи.
 */
export async function readStudentRows(filePath: string): Promise<Student[]> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) return [];
  return parseStudentRows(await file.json());
}

/**
 * Пишет студентов в `students.json` в формате, который читает
 * `StudentJsonRepo`: `version` и числовые даты сохраняются как в `rows`.
 */
export async function writeStudentRows(
  filePath: string,
  rows: readonly Student[],
): Promise<void> {
  await Bun.write(filePath, JSON.stringify(rows, undefined, 2));
}

/** Информация об опережающем студенте для отчёта */
export interface AheadStudentInfo {
  studentUuid: string;
  userId: string;
  currentStepId: string;
  currentStepIndex: number;
  newStepId: string;
  newStepIndex: number;
}

/** Результат анализа дельты снапшотов */
export interface SnapshotDeltaAnalysis {
  /** Идентификаторы добавленных шагов */
  addedStepIds: string[];
  /** Идентификаторы удалённых шагов */
  removedStepIds: string[];
  /** Список студентов, которые обогнали добавленные шаги */
  aheadStudents: AheadStudentInfo[];
  /** Есть ли конфликт (добавлены шаги позади хотя бы одного студента) */
  hasConflict: boolean;
}

/**
 * Извлекает плоский упорядоченный список UUID всех шагов из снапшота контента.
 */
export function extractStepIds(snapshot: ContentSnapshot): string[] {
  const ids: string[] = [];
  for (const project of snapshot) {
    for (const lesson of project.lessons) {
      for (const stepId of lesson.stepIds) {
        ids.push(stepId);
      }
    }
  }
  return ids;
}

/**
 * Проверяет, прошёл ли студент позицию шага в программе.
 * Студент считается прошедшим шаг, если:
 * 1. Его статус терминальный успешный ('advanced' / 'not_advanced'), либо
 * 2. Его текущий шаг (currentStepId) находится СТРОГО ДАЛЬШЕ в новой структуре программы, либо
 * 3. Он завершил последний шаг программы.
 */
export function isStudentAheadOfStep(
  student: Student,
  stepIndex: number,
  newStepIds: string[],
): boolean {
  if (student.status === 'advanced' || student.status === 'not_advanced') {
    return true;
  }

  const studentStepIndex = newStepIds.indexOf(student.currentStepId);
  if (studentStepIndex === -1) {
    // Если текущий шаг студента не найден в новой программе — не можем однозначно определить
    return false;
  }

  if (studentStepIndex > stepIndex) {
    return true;
  }

  // Если студент находится на самом последнем шаге программы и уже завершил его
  if (
    studentStepIndex === newStepIds.length - 1 &&
    studentStepIndex === stepIndex
  ) {
    const isCompleted = student.steps.some(
      (s) => s.stepId === student.currentStepId && s.status === 'completed',
    );
    if (isCompleted) return true;
  }

  return false;
}

/**
 * Анализирует изменения между старым и новым снапшотом для заданного списка студентов.
 */
export function analyzeSnapshotDelta(
  oldSnapshot: ContentSnapshot,
  newSnapshot: ContentSnapshot,
  students: Student[],
): SnapshotDeltaAnalysis {
  const oldStepIds = extractStepIds(oldSnapshot);
  const newStepIds = extractStepIds(newSnapshot);

  const addedStepIds = newStepIds.filter((id) => !oldStepIds.includes(id));
  const removedStepIds = oldStepIds.filter((id) => !newStepIds.includes(id));

  const aheadStudents: AheadStudentInfo[] = [];

  for (const newStepId of addedStepIds) {
    const newStepIndex = newStepIds.indexOf(newStepId);

    for (const student of students) {
      // Игнорируем студентов, которые бросили обучение
      if (student.status === 'abandoned') {
        continue;
      }

      if (isStudentAheadOfStep(student, newStepIndex, newStepIds)) {
        // Проверяем, нет ли уже этого шага у студента как completed
        const alreadyHasCompleted = student.steps.some(
          (s) => s.stepId === newStepId && s.status === 'completed',
        );
        if (!alreadyHasCompleted) {
          aheadStudents.push({
            studentUuid: student.uuid,
            userId: student.userId,
            currentStepId: student.currentStepId,
            currentStepIndex: newStepIds.indexOf(student.currentStepId),
            newStepId,
            newStepIndex,
          });
        }
      }
    }
  }

  return {
    addedStepIds,
    removedStepIds,
    aheadStudents,
    hasConflict: aheadStudents.length > 0,
  };
}

/**
 * Синхронизирует студентов: добавляет новые шаги в статусе 'completed' тем студентам,
 * которые уже ушли вперёд точки вставки.
 * Возвращает количество обновлённых студентов и мутирует массив students.
 */
export function syncAheadStudents(
  newSnapshot: ContentSnapshot,
  students: Student[],
  addedStepIds: string[],
  at: number = now().getTime(),
): { updatedCount: number; updatedStudentUuids: string[] } {
  const newStepIds = extractStepIds(newSnapshot);
  const updatedUuids = new Set<string>();

  for (const newStepId of addedStepIds) {
    const newStepIndex = newStepIds.indexOf(newStepId);

    for (const student of students) {
      if (student.status === 'abandoned') {
        continue;
      }

      if (isStudentAheadOfStep(student, newStepIndex, newStepIds)) {
        const existingRecord = student.steps.find(
          (s) => s.stepId === newStepId,
        );
        if (!existingRecord) {
          const newRecord: StepRecord = {
            stepId: newStepId,
            status: 'completed',
            issuedAt: at,
            completedAt: at,
          };
          student.steps.push(newRecord);
          updatedUuids.add(student.uuid);
        } else if (existingRecord.status !== 'completed') {
          existingRecord.status = 'completed';
          existingRecord.completedAt = at;
          updatedUuids.add(student.uuid);
        }
      }
    }
  }

  return {
    updatedCount: updatedUuids.size,
    updatedStudentUuids: Array.from(updatedUuids),
  };
}

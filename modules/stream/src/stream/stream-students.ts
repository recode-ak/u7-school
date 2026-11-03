import type { StreamStudentFact } from '@u7-scl/domain/stream';

/**
 * Порт к студентам потока. Студент — чужой агрегат (legacy до Ф2), поток
 * спрашивает только факты и просит запустить учёбу; реализация — мост
 * `infra/legacy-stream-students`.
 */
export interface StreamStudents {
  /** Факты о студентах потока: исход, «учится», «не начинал». */
  factsOf(streamId: string): Promise<StreamStudentFact[]>;

  /**
   * Запуск потока для студентов: зачисленные становятся активными, студентам
   * без шагов выдаётся первый шаг.
   */
  launch(streamId: string, firstStepId: string): Promise<void>;
}

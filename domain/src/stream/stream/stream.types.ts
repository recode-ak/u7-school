/**
 * Факт о студенте потока для домена потока: чужой агрегат (студент)
 * отвечает за исход, поток спрашивает только итог. Строит порт
 * `StreamStudents` прикладного слоя.
 */
export type StreamStudentFact = {
  readonly studentId: string;
  readonly userId: string;
  /** Сырой статус студента в потоке. */
  readonly status:
    | 'enrolled'
    | 'active'
    | 'abandoned'
    | 'advanced'
    | 'not_advanced';
  /** У студента есть итоговый исход — поток не ждёт его. */
  readonly settled: boolean;
  /** Студент учится или только зачислен. */
  readonly inProgress: boolean;
  /** Студент ещё не приступал к шагам. */
  readonly neverStarted: boolean;
};
